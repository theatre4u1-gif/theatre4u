// Ensures the active brand's iOS project has the UIScene lifecycle support that
// the iOS 26 SDK (Xcode 27+) requires. Capacitor 6 ships the legacy AppDelegate-
// window lifecycle, so a freshly-generated iOS project crashes at launch with
// "UIScene life cycle is required for apps built with this SDK" (black screen).
//
// This runs after `cap sync` (see package.json app:*:sync). It is idempotent —
// it only patches a file that doesn't already have the fix, and it skips the
// whole thing when the brand's iOS project hasn't been generated yet.
//
// Brand → iOS path mirrors capacitor.config.ts:
//   theatre4u (default) → ios, artstracker → ios-artstracker, bintrove → ios-bintrove
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BRAND = process.env.BRAND || 'theatre4u';
const IOS_PATH = BRAND === 'artstracker' ? 'ios-artstracker'
               : BRAND === 'bintrove'    ? 'ios-bintrove'
               : 'ios';

const plistPath = `${IOS_PATH}/App/App/Info.plist`;
const appDelPath = `${IOS_PATH}/App/App/AppDelegate.swift`;

if (!existsSync(appDelPath) || !existsSync(plistPath)) {
  console.log(`fix-ios-scene: ${IOS_PATH} not generated yet — nothing to do (run 'npx cap add ios' for this brand first).`);
  process.exit(0);
}

// ── Info.plist: add the scene manifest ──────────────────────────────────────
const SCENE_MANIFEST = `	<key>UIApplicationSceneManifest</key>
	<dict>
		<key>UIApplicationSupportsMultipleScenes</key>
		<false/>
		<key>UISceneConfigurations</key>
		<dict>
			<key>UIWindowSceneSessionRoleApplication</key>
			<array>
				<dict>
					<key>UISceneConfigurationName</key>
					<string>Default Configuration</string>
				</dict>
			</array>
		</dict>
	</dict>
`;
let plist = readFileSync(plistPath, 'utf8');
if (plist.includes('UIApplicationSceneManifest')) {
  console.log(`fix-ios-scene: ${plistPath} already has the scene manifest.`);
} else {
  const anchor = '\t<key>UIMainStoryboardFile</key>\n\t<string>Main</string>\n';
  if (plist.includes(anchor)) {
    plist = plist.replace(anchor, anchor + SCENE_MANIFEST);
  } else {
    // Fallback: insert before the closing </dict></plist>.
    plist = plist.replace(/<\/dict>\s*<\/plist>\s*$/, SCENE_MANIFEST + '</dict>\n</plist>\n');
  }
  writeFileSync(plistPath, plist);
  console.log(`fix-ios-scene: added UIApplicationSceneManifest to ${plistPath}`);
}

// ── Info.plist: camera + photo-library usage strings ────────────────────────
// Scan (barcode) and "add photo" use the camera; iOS HARD-CRASHES an app that
// touches the camera/photo library without these Info.plist strings (the app
// drops straight to the home screen). The default Capacitor template omits them.
if (!plist.includes('NSCameraUsageDescription')) {
  const CAM = `\t<key>NSCameraUsageDescription</key>\n\t<string>Used to scan QR and barcode labels and to take photos of your items.</string>\n\t<key>NSPhotoLibraryAddUsageDescription</key>\n\t<string>Save QR label images to your photos.</string>\n\t<key>NSPhotoLibraryUsageDescription</key>\n\t<string>Attach photos to your items.</string>\n`;
  plist = plist.replace(/<\/dict>\s*<\/plist>\s*$/, CAM + '</dict>\n</plist>\n');
  writeFileSync(plistPath, plist);
  console.log(`fix-ios-scene: added camera + photo usage strings to ${plistPath}`);
} else {
  console.log(`fix-ios-scene: ${plistPath} already has camera usage strings.`);
}

// ── Info.plist: export-compliance key (ITSAppUsesNonExemptEncryption) ─────────
// The apps use only standard HTTPS (exempt encryption). Declaring this here
// auto-answers Apple's per-build export-compliance question, so TestFlight never
// shows "Missing Compliance" and submissions don't stop to ask. Value = false
// ("no non-exempt encryption"). Re-read plist from disk in case it changed above.
plist = readFileSync(plistPath, 'utf8');
if (!plist.includes('ITSAppUsesNonExemptEncryption')) {
  const ENC = `\t<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>\n`;
  plist = plist.replace(/<\/dict>\s*<\/plist>\s*$/, ENC + '</dict>\n</plist>\n');
  writeFileSync(plistPath, plist);
  console.log(`fix-ios-scene: added ITSAppUsesNonExemptEncryption=false to ${plistPath}`);
} else {
  console.log(`fix-ios-scene: ${plistPath} already declares export compliance.`);
}

// ── AppDelegate.swift: add the scene configuration hook + SceneDelegate ──────
const SCENE_CODE = `        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }

}

// Scene lifecycle support (required by the iOS 26 SDK). Capacitor 6 ships the
// legacy AppDelegate-window lifecycle; this hosts the Main storyboard's root
// view controller (the Capacitor bridge VC) in a UIWindowScene.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = CAPBridgeViewController()
        self.window = window
        window.makeKeyAndVisible()
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        guard let url = URLContexts.first?.url else { return }
        ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: userActivity) { _ in }
    }

}`;
// The exact tail of the stock Capacitor 6 AppDelegate (the continue(...) method
// then the class close). Matching it lets us inject the scene code precisely.
const ANCHOR = `        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}`;
let appDel = readFileSync(appDelPath, 'utf8');
if (appDel.includes('class SceneDelegate')) {
  console.log(`fix-ios-scene: ${appDelPath} already has SceneDelegate.`);
} else if (appDel.includes(ANCHOR)) {
  appDel = appDel.replace(ANCHOR, SCENE_CODE);
  writeFileSync(appDelPath, appDel);
  console.log(`fix-ios-scene: added SceneDelegate + scene hook to ${appDelPath}`);
} else {
  console.warn(`fix-ios-scene: WARNING — could not find the expected AppDelegate template in ${appDelPath}. ` +
    `Apply the UIScene fix manually (see ios/App/App/AppDelegate.swift for the reference).`);
}

// ── project.pbxproj: signing team + iOS 17 deployment target ─────────────────
// Xcode 27 rejects deployment targets below iOS 17 (30 "deployment target" build
// errors), and a freshly-generated project has no DEVELOPMENT_TEAM so Archive
// fails with a signing error. Both live in the (gitignored) native project, so
// we re-assert them on every sync. Override the team with APPLE_TEAM_ID if needed.
const TEAM = process.env.APPLE_TEAM_ID || '45N7MZK3FC'; // Artstracker LLC
const pbxPath = `${IOS_PATH}/App/App.xcodeproj/project.pbxproj`;
if (existsSync(pbxPath)) {
  let pbx = readFileSync(pbxPath, 'utf8');
  let changed = false;
  const raised = pbx.replace(/IPHONEOS_DEPLOYMENT_TARGET = (?:[1-9]|1[0-6])(?:\.\d+)?;/g, 'IPHONEOS_DEPLOYMENT_TARGET = 17.0;');
  if (raised !== pbx) { pbx = raised; changed = true; }
  if (!pbx.includes('DEVELOPMENT_TEAM')) {
    pbx = pbx.replace(/(\n(\s*)CODE_SIGN_STYLE = Automatic;)/g, (_m, line, indent) => `${line}\n${indent}DEVELOPMENT_TEAM = ${TEAM};`);
    changed = true;
  }
  if (changed) { writeFileSync(pbxPath, pbx); console.log(`fix-ios-scene: set signing team + iOS 17 deployment target in ${pbxPath}`); }
  else console.log(`fix-ios-scene: ${pbxPath} already has team + iOS 17 deployment target.`);
}

// ── Podfile: platform iOS 17 + force every pod to 17 (Xcode 27) ──────────────
// cap sync runs `pod install` with the Podfile as it was BEFORE this script, so
// when we change it here we re-run `pod install` once to regenerate the Pods at
// iOS 17 (otherwise the pods keep the old 13.0 target and the build fails).
const podPath = `${IOS_PATH}/App/Podfile`;
if (existsSync(podPath)) {
  let pod = readFileSync(podPath, 'utf8');
  let changed = false;
  const bumped = pod.replace(/platform :ios, '(?:[1-9]|1[0-6])(?:\.\d+)?'/, "platform :ios, '17.0'");
  if (bumped !== pod) { pod = bumped; changed = true; }
  if (!pod.includes("config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'")) {
    const anchor = "post_install do |installer|\n  assertDeploymentTarget(installer)\nend";
    if (pod.includes(anchor)) {
      pod = pod.replace(anchor,
        "post_install do |installer|\n  assertDeploymentTarget(installer)\n" +
        "  # Force every pod to the app's minimum (Xcode 27 rejects anything below iOS 17).\n" +
        "  installer.pods_project.targets.each do |target|\n" +
        "    target.build_configurations.each do |config|\n" +
        "      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '17.0'\n" +
        "    end\n  end\nend");
      changed = true;
    }
  }
  // ── ITMS-91061: GoogleToolboxForMac ships no privacy manifest ──────────────
  // MLKit's barcode scanner pins GoogleToolboxForMac to the 2.x line, which
  // predates Apple's privacy-manifest requirement and never shipped one. Apple's
  // automated App Store scan REJECTS the binary ("Invalid Binary", ITMS-91061)
  // the moment it's submitted. We can't bump the pod (MLKit locks it), so we
  // inject a minimal PrivacyInfo.xcprivacy into GoogleToolboxForMac.framework via
  // a post_install hook (it's re-signed with the app's cert during Archive).
  const GTM_PRIVACY = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>NSPrivacyTracking</key>
\t<false/>
\t<key>NSPrivacyTrackingDomains</key>
\t<array/>
\t<key>NSPrivacyCollectedDataTypes</key>
\t<array/>
\t<key>NSPrivacyAccessedAPITypes</key>
\t<array/>
</dict>
</plist>
`;
  const gtmDir = `${IOS_PATH}/App/PrivacyManifests/GoogleToolboxForMac`;
  const gtmManifest = `${gtmDir}/PrivacyInfo.xcprivacy`;
  if (!existsSync(gtmManifest)) {
    mkdirSync(gtmDir, { recursive: true });
    writeFileSync(gtmManifest, GTM_PRIVACY);
    console.log(`fix-ios-scene: wrote ${gtmManifest}`);
  }
  if (!pod.includes('gtm_manifest')) {
    const gtmRuby =
      "\n  # ITMS-91061: GoogleToolboxForMac (pinned to 2.x by MLKit) ships no\n" +
      "  # privacy manifest. Inject one into its framework so App Store validation\n" +
      "  # stops rejecting the binary. The file is re-signed during Archive.\n" +
      "  gtm_manifest = File.join(__dir__, 'PrivacyManifests', 'GoogleToolboxForMac', 'PrivacyInfo.xcprivacy')\n" +
      "  if File.exist?(gtm_manifest)\n" +
      "    installer.pods_project.targets.each do |t|\n" +
      "      next unless t.name == 'GoogleToolboxForMac'\n" +
      "      ref = installer.pods_project.new_file(gtm_manifest)\n" +
      "      t.resources_build_phase.add_file_reference(ref, true)\n" +
      "    end\n" +
      "  end\n";
    // insert just before the final `end` that closes the post_install block
    pod = pod.replace(/\nend(\s*)$/, gtmRuby + 'end$1');
    changed = true;
  }
  if (changed) {
    writeFileSync(podPath, pod);
    console.log(`fix-ios-scene: raised ${podPath} to iOS 17 — re-running pod install…`);
    try {
      execSync('pod install', { cwd: `${IOS_PATH}/App`, stdio: 'inherit' });
    } catch (e) {
      console.warn(`fix-ios-scene: WARNING — 'pod install' failed; run it manually in ${IOS_PATH}/App. (${e.message})`);
    }
  } else {
    console.log(`fix-ios-scene: ${podPath} already at iOS 17.`);
  }
}

// ── App Privacy Manifest: PrivacyInfo.xcprivacy (ITMS-91053) ─────────────────
// Apple's automated scan REJECTS a submission ("Invalid Binary", within minutes,
// before human review) when the app calls a "required reason" API without
// declaring it in an app-level PrivacyInfo.xcprivacy. Capacitor's core uses
// UserDefaults, Filesystem uses file timestamps + disk space, and networking
// reads system boot time — and the Capacitor pod ships NO manifest — so the App
// target itself must carry one. The Capacitor template generates none, so we
// create it and wire it into the App target's Resources build phase. Idempotent.
const PRIVACY = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>NSPrivacyTracking</key>
\t<false/>
\t<key>NSPrivacyTrackingDomains</key>
\t<array/>
\t<key>NSPrivacyCollectedDataTypes</key>
\t<array/>
\t<key>NSPrivacyAccessedAPITypes</key>
\t<array>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryUserDefaults</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array><string>CA92.1</string></array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array><string>C617.1</string></array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategorySystemBootTime</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array><string>35F9.1</string></array>
\t\t</dict>
\t\t<dict>
\t\t\t<key>NSPrivacyAccessedAPIType</key>
\t\t\t<string>NSPrivacyAccessedAPICategoryDiskSpace</string>
\t\t\t<key>NSPrivacyAccessedAPITypeReasons</key>
\t\t\t<array><string>E174.1</string></array>
\t\t</dict>
\t</array>
</dict>
</plist>
`;
const privPath = `${IOS_PATH}/App/App/PrivacyInfo.xcprivacy`;
if (!existsSync(privPath)) {
  writeFileSync(privPath, PRIVACY);
  console.log(`fix-ios-scene: wrote ${privPath}`);
} else {
  console.log(`fix-ios-scene: ${privPath} already present.`);
}
if (existsSync(pbxPath)) {
  let p = readFileSync(pbxPath, 'utf8');
  if (p.includes('PrivacyInfo.xcprivacy')) {
    console.log(`fix-ios-scene: ${pbxPath} already references PrivacyInfo.xcprivacy.`);
  } else {
    const FREF = 'D1AD0BE1EF1A5100C0FFEE01'; // PBXFileReference UID (unique, no collision)
    const BF   = 'D1AD0BE1EF1A5100C0FFEE02'; // PBXBuildFile UID
    let ok = true;
    // 1) PBXBuildFile — after the Assets.xcassets build-file line (ends with "};").
    const bfAnchor = /(\n\t\t\S+ \/\* Assets\.xcassets in Resources \*\/ = \{isa = PBXBuildFile;[^\n]*\};)/;
    if (bfAnchor.test(p)) p = p.replace(bfAnchor, `$1\n\t\t${BF} /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = ${FREF} /* PrivacyInfo.xcprivacy */; };`);
    else ok = false;
    // 2) PBXFileReference — after the Info.plist file-reference line.
    const frAnchor = /(\n\t\t\S+ \/\* Info\.plist \*\/ = \{isa = PBXFileReference;[^\n]*\};)/;
    if (frAnchor.test(p)) p = p.replace(frAnchor, `$1\n\t\t${FREF} /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };`);
    else ok = false;
    // 3) App group children — after the Info.plist child entry (ends with ",").
    const grpAnchor = /(\n\t+\S+ \/\* Info\.plist \*\/,)/;
    if (grpAnchor.test(p)) p = p.replace(grpAnchor, `$1\n\t\t\t\t${FREF} /* PrivacyInfo.xcprivacy */,`);
    else ok = false;
    // 4) PBXResourcesBuildPhase files — after the Assets.xcassets entry (ends with ",").
    const resAnchor = /(\n\t+\S+ \/\* Assets\.xcassets in Resources \*\/,)/;
    if (resAnchor.test(p)) p = p.replace(resAnchor, `$1\n\t\t\t\t${BF} /* PrivacyInfo.xcprivacy in Resources */,`);
    else ok = false;
    if (ok) {
      writeFileSync(pbxPath, p);
      console.log(`fix-ios-scene: wired PrivacyInfo.xcprivacy into the App target in ${pbxPath}`);
    } else {
      console.warn(`fix-ios-scene: WARNING — could not wire PrivacyInfo.xcprivacy into ${pbxPath}. ` +
        `Add App/App/PrivacyInfo.xcprivacy to the App target (Copy Bundle Resources) manually in Xcode.`);
    }
  }
}
