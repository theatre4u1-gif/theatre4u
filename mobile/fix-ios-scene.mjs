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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

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
