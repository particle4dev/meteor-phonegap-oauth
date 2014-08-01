// From phonegap-oauth (Adam Brodzinski)
// Meteor's OAuth flow currently only works with popups. Phonegap does
// not handle this well. Using the InAppBrowser plugin we can load the
// OAuth popup into it. Using the plugin by itself would not work with
// the MeteorRider phonegap method, this fixes it. This has not been
// tested on other Meteor phonegap methods. (tested on PG 3.3, android, iOS)
//
// http://docs.phonegap.com/en/3.3.0/cordova_inappbrowser_inappbrowser.md.html
// https://github.com/zeroasterisk/MeteorRider
window.patchWindow = function () {
    // Prevent the window from being patched twice.
    if (window.IAB) return;

    // Make sure the InAppBrowser is loaded before patching the window.
    try {
        window.cordova.require('org.apache.cordova.inappbrowser.inappbrowser');
    } catch (e) {
        return false;
    }

    // Keep a reference to the in app browser's window.open.
    var __open = window.open,
        oauthWin,
        checkMessageInterval;

    // Create an object to return from a monkeypatched window.open call. Handles
    // open/closed state of popup to keep Meteor happy. Allows one to save window
    // reference to a variable and close it later. e.g.,
    // `var foo = window.open('url');  foo.close();
    window.IAB = {
        closed: true,

        open: function (url) {
            var self = this;
            // XXX add options param and append to current options
            oauthWin = __open(url, '_blank', 'location=no,hidden=yes');

            oauthWin.removeEventListener('loadstop', checkIfOauthIsDone);
            oauthWin.removeEventListener('loaderror', checkIfOauthIsDone);

            // Close the InAppBrowser on exit -- triggered when the
            // user goes back when there are not pages in the history.
            oauthWin.addEventListener('exit', close);

            oauthWin.show();

            // Plugin messages are not processed on Android until the next
            // message this prevents the oauthWin event listeners from firing.
            // Call exec on an interval to force process messages.
            // http://stackoverflow.com/q/23352940/230462 and
            // http://stackoverflow.com/a/24319063/230462
            if (device.platform === 'Android') {
                checkMessageInterval = setInterval(function () {
                    cordova.exec(null, null, '', '', [])
                }, 200);
            }

            function close() {
                clearTimeout(checkMessageInterval);

                // close the window
                IAB.close();

                // remove the listeners
                oauthWin.removeEventListener('loadstop', checkIfOauthIsDone);
                oauthWin.removeEventListener('loaderror', checkIfOauthIsDone);
                oauthWin.removeEventListener('exit', close);
            }

            // check if uri contains an error or code param, then manually close popup
            function checkIfOauthIsDone(event) {
                var q = matchUrl(event.url);
                if(q.path == "/_phoneoauth" && isNull(q.query.close)){
                  Package.oauth.OAuth._handleCredentialSecret(q.query.token, q.query.secret);
                  Accounts.oauth.tryLoginAfterPopupClosed(q.query.secret);
                  close();
                }     
            }

            this.closed = false;
        },

        close: function () {
            if (!oauthWin) return;
            oauthWin.close();
            this.closed = true;
        }
    };

    // monkeypatch window.open on the phonegap platform
    if (typeof device !== "undefined") {
        window.open = function (url) {
            IAB.open(url);
            // return InAppBrowser so you can set foo = open(...) and then foo.close()
            return IAB;
        };
    }

    return true;
};

// Patch the window after cordova is finished loading
// if the InAppBrowser is not available yet.
if (!window.patchWindow()) document.addEventListener('deviceready', window.patchWindow, false);

// util url
function matchUrl(c) {
  var b = void 0,
    d = "url,,scheme,,authority,path,,query,,fragment".split(","),
    e = /^(([^\:\/\?\#]+)\:)?(\/\/([^\/\?\#]*))?([^\?\#]*)(\?([^\#]*))?(\#(.*))?/,
    a = {
      url: void 0,
      scheme: void 0,
      authority: void 0,
      path: void 0,
      query: void 0,
      fragment: void 0,
      valid: !1
    };
  "string" === typeof c && "" != c && (b = c.match(e));
  if ("object" === typeof b)
    for (x in b) d[x] && "" != d[x] && (a[d[x]] = b[x]);
  a.scheme && a.authority && (a.valid = !0);
  a.query = getQueryVariable(a.query);
  return a
}
function isNull(obj) {
  return obj === null;
}
function isUndefined (obj) {
  return obj === void 0;
} 
function getQueryVariable(query) {
  var vars = query.split("&");
  var result = {};
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split("=");
    if(isUndefined(pair[1]))
      result[pair[0]] = null;
    else
      result[pair[0]] = pair[1];
  }
  return result;
}