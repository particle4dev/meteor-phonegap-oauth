// Meteor's OAuth flow currently only works with popups. Phonegap does
// not handle this well. Using the InAppBrowser plugin we can load the
// OAuth popup into it. Using the plugin by itself would not work with
// the MeteorRider phonegap method, this fixes it. This has not been
// tested on other Meteor phonegap methods. (tested on PG 3.3, android,iOS)
//
// http://docs.phonegap.com/en/3.3.0/cordova_inappbrowser_inappbrowser.md.html
// https://github.com/zeroasterisk/MeteorRider

var __open = window.open,
    oauthWin,
    timer;

// Create an object to return from a monkeypatched window.open call. Handles
// open/closed state of popup to keep Meteor happy. Allows one to save window
// referrence to a variable and close it later. e.g.,
// `var foo = window.open('url');  foo.close();
//
window.IAB = {
  closed: true,
  open: function (url) {
    var self = this;
    // TODO add options param and append to current options
    oauthWin = __open(url, '_blank', 'location=no,hidden=yes');
    oauthWin.addEventListener('loadstop', checkIfOauthIsDone);
    oauthWin.addEventListener('loaderror', checkIfOauthIsDone);
    // use hidden=yes as a hack for Android, allows popup to  yield events with
    // each #show call. Lets events run on Meteor app, otherwise all listeners
    // will *only* run when tapping done button or oauthWin.close
    //
    // FIXME should be a better way to do this...
    if (device.platform === 'Android') {
      timer = setInterval(oauthWin.show, 200);
    }
    else {
      oauthWin.show();
    }
    // check if uri contains an error or code param, then manually close popup
    function checkIfOauthIsDone(event) {
      console.log('CHECK IF OAUTH IS DONE URL');
      console.log(event.url);
      var q = matchUrl(event.url);
      console.log(q.path);
      if(q.path == "/_phoneoauth" && isNull(q.query.close)){
        console.log('DONE FIRED');
        console.log(q.query.token);
        console.log(q.query.secret);
        console.log(Package.oauth.OAuth._handleCredentialSecret.toString());
        console.log(Accounts.oauth.tryLoginAfterPopupClosed.toString());
        Package.oauth.OAuth._handleCredentialSecret(q.query.token, q.query.secret);
        Accounts.oauth.tryLoginAfterPopupClosed(q.query.secret);
        clearInterval(timer);
        oauthWin.removeEventListener('loadstop', checkIfOauthIsDone);
        oauthWin.removeEventListener('loaderror', checkIfOauthIsDone);
        self.close();
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
// url
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
//console.log(matchUrl('http://throwflag.meteor.com/_phoneoauth?close&token=4Dq6WdGvImpr-dQo6aCzieF64jCQ8qRH15RdhVL4Qg1&secret=JmpHqhUHvW_IgRKcON5lOFxzLzxvr8smd5aIv-AOnwn'));