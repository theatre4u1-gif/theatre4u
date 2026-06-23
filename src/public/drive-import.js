// Google Drive photo import — exposes window.t4uPickFromDrive(onFile).
// onFile receives a downloaded File (image) to feed into the app's normal photo-upload path.
// Uses the Google Picker with the drive.file scope (app only sees files the user explicitly picks).
(function () {
  var CLIENT_ID = "33303253369-j21rc2jvqtrg5kf3ajpja1dg55n77fmh.apps.googleusercontent.com";
  var API_KEY = "AIzaSyBDJu1y0B4-UKxNeFGCDiEal_mJa3bU5r8";
  var APP_ID = "33303253369"; // project number (prefix of the client ID) — required for drive.file picks to grant access
  var SCOPE = "https://www.googleapis.com/auth/drive.file";
  var pickerLoaded = false;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.async = true; s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function ensureLoaded() {
    if (!(window.google && google.accounts && google.accounts.oauth2)) {
      await loadScript("https://accounts.google.com/gsi/client");
    }
    if (!window.gapi) {
      await loadScript("https://apis.google.com/js/api.js");
    }
    if (!pickerLoaded) {
      await new Promise(function (res) { gapi.load("picker", { callback: res }); });
      pickerLoaded = true;
    }
  }

  function getToken() {
    return new Promise(function (resolve, reject) {
      var tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: function (resp) {
          if (resp && resp.access_token) resolve(resp.access_token);
          else reject((resp && resp.error) || "no_token");
        },
      });
      tokenClient.requestAccessToken({ prompt: "" });
    });
  }

  // onFile: called with a File for each picked image. Multi-select supported.
  window.t4uPickFromDrive = async function (onFile) {
    try {
      await ensureLoaded();
      var token = await getToken();
      var view = new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);
      var picker = new google.picker.PickerBuilder()
        .setOAuthToken(token)
        .setDeveloperKey(API_KEY)
        .setAppId(APP_ID)
        .addView(view)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setCallback(async function (data) {
          if (data.action !== google.picker.Action.PICKED || !data.docs) return;
          for (var i = 0; i < data.docs.length; i++) {
            var doc = data.docs[i];
            try {
              var res = await fetch(
                "https://www.googleapis.com/drive/v3/files/" + doc.id + "?alt=media",
                { headers: { Authorization: "Bearer " + token } }
              );
              if (!res.ok) throw new Error("download failed " + res.status);
              var blob = await res.blob();
              var file = new File([blob], doc.name || "drive-photo.jpg", { type: blob.type || "image/jpeg" });
              onFile(file);
            } catch (e) {
              console.error("Drive download failed", e);
              alert("Couldn't download a photo from Google Drive (" + (e && e.message ? e.message : e) + "). Please try again.");
            }
          }
        })
        .build();
      picker.setVisible(true);
    } catch (e) {
      console.error("Drive picker error", e);
      alert("Couldn't open Google Drive. Please try again, and make sure pop-ups aren't blocked for this site.");
    }
  };
})();
