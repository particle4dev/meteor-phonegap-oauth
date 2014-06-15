var Fiber = Npm.require('fibers');
var url = Npm.require('url');
var logging = function(message){
    DEBUGX.info('OAUTH', message);
};
//https://github.com/meteor/meteor/blob/devel/packages/oauth/oauth_server.js
var isSafe = function (value) {
  // This matches strings generated by `Random.secret` and
  // `Random.id`.
  return typeof value === "string" &&
    /^[a-zA-Z0-9\-_]+$/.test(value);
};
// Internal: used by the oauth1 and oauth2 packages
OAuth._renderOauthResults = function(res, query, credentialSecret) {
  // We expect the ?close parameter to be present, in which case we
  // close the popup at the end of the OAuth flow. Any other query
  // string should just serve a blank page. For tests, we support the
  // `only_credential_secret_for_test` parameter, which just returns the
  // credential secret without any surrounding HTML. (The test needs to
  // be able to easily grab the secret and use it to log in.)
  //
  // XXX only_credential_secret_for_test could be useful for other
  // things beside tests, like command-line clients. We should give it a
  // real name and serve the credential secret in JSON.
  if (query.only_credential_secret_for_test) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(credentialSecret, 'utf-8');
  } else {
    var details = { query: query };
    if (query.error) {
      details.error = query.error;
    } else {
      var token = query.state;
      var secret = credentialSecret;
      if (token && secret &&
          isSafe(token) && isSafe(secret)) {
        details.credentials = { token: token, secret: secret};
      } else {
        details.error = "invalid_credential_token_or_secret";
      }
    }

    OAuth._endOfLoginResponse(res, details);
  }
};

// Writes an HTTP response to the popup window at the end of an OAuth
// login flow. At this point, if the user has successfully authenticated
// to the OAuth server and authorized this app, we communicate the
// credentialToken and credentialSecret to the main window. The main
// window must provide both these values to the DDP `login` method to
// authenticate its DDP connection. After communicating these vaues to
// the main window, we close the popup.
//
// We export this function so that developers can override this
// behavior, which is particularly useful in, for example, some mobile
// environments where popups and/or `window.opener` don't work. For
// example, an app could override `OAuth._endOfLoginResponse` to put the
// credential token and credential secret in the popup URL for the main
// window to read them there instead of using `window.opener`. If you
// override this function, you take responsibility for writing to the
// request and calling `res.end()` to complete the request.
//
// Arguments:
//   - res: the HTTP response object
//   - details:
//      - query: the query string on the HTTP request
//      - credentials: { token: *, secret: * }. If present, this field
//        indicates that the login was successful. Return these values
//        to the client, who can use them to log in over DDP. If
//        present, the values have been checked against a limited
//        character set and are safe to include in HTML.
//      - error: if present, a string or Error indicating an error that
//        occurred during the login. This can come from the client and
//        so shouldn't be trusted for security decisions or included in
//        the response without sanitizing it first. Only one of `error`
//        or `credentials` should be set.
OAuth._endOfLoginResponse = function(res, details) {

  res.writeHead(200, {'Content-Type': 'text/html'});

  var content = function (setCredentialSecret) {
    return '<html><head><script>' +
      setCredentialSecret +
      //'window.close();</script></head></html>';
      '</script></head></html>';
  };

  if (details.error) {
    Log.warn("Error in OAuth Server: " +
             (details.error instanceof Error ?
              details.error.message : details.error));
    res.end(content(""), 'utf-8');
    return;
  }
  /**
  if ("close" in details.query) {
    // If we have a credentialSecret, report it back to the parent
    // window, with the corresponding credentialToken. The parent window
    // uses the credentialToken and credentialSecret to log in over DDP.
    var setCredentialSecret = '';
    if (details.credentials.token && details.credentials.secret) {
      setCredentialSecret = 'var credentialToken = ' +
        JSON.stringify(details.credentials.token) + ';' +
        'var credentialSecret = ' +
        JSON.stringify(details.credentials.secret) + ';' +
        'window.opener && ' +
        'window.opener.Package.oauth.OAuth._handleCredentialSecret(' +
        'credentialToken, credentialSecret);';
    }
    res.end(content(setCredentialSecret), "utf-8");
  }*/
  if ("close" in details.query) {
    var setCredentialSecret = '';
    if (details.credentials.token && details.credentials.secret) {
      setCredentialSecret =
      'try {' +
      //'if (typeof device === "undefined") {' +
        //'var credentialToken = ' +
        //JSON.stringify(details.credentials.token) + ';' +
        //'var credentialSecret = ' +
        //JSON.stringify(details.credentials.secret) + ';' +
        //'window.opener && ' +
        //'window.opener.Package.oauth.OAuth._handleCredentialSecret(' +
        //'credentialToken, credentialSecret);' +
        //'console.log("Browser");' +
        //'window.close();' +
        //'} else {' +
        'console.log("Mobile");' +
        'window.location.replace("' + Meteor.absoluteUrl() + '_phoneoauth?close&token=' + details.credentials.token + '&secret=' + details.credentials.secret + '");' +
        //'}' +
        '}catch(e){' +
        'console.error(e.message);' +
        '/**reload page*/' +
        'window.location.reload(false);' +
        '}';
        logging(content(setCredentialSecret));
    }
    res.end(content(setCredentialSecret), "utf-8");
  } else {
    res.end("", "utf-8");
  }
};

/**
 *
 */
RoutePolicy.declare('/_phoneoauth', 'network');
// Listen to incoming OAuth http requests
WebApp.connectHandlers.use(function(req, res, next) {
  Fiber(function () {
    processPhoneoauth(req, res, next);
  }).run();
});
var processPhoneoauth = function (req, res, next) {
  try {
    var phoneoauth = isPhoneoauthPath(req);
    if (!phoneoauth) {
      // not an oauth request. pass to next middleware.
      next();
      return;
    }
    logging(req.url);
    res.writeHead(200, {'Content-Type': 'text/html'});
    var content = function (setCredentialSecret) {
      return '<html><head><script>' +
        setCredentialSecret +
        'window.close()</script></head></html>';
    };
    res.end(content(""), "utf-8");
    res.end("", "utf-8");
  } catch (err) {
    
  }
};
var isPhoneoauthPath = function (req) {
  // req.url will be "/_phoneoauth?<action>"
  var barePath = req.url.substring(0, req.url.indexOf('?'));
  var splitPath = barePath.split('/');

  // Any non-oauth request will continue down the default
  // middlewares.
  if (splitPath[1] !== '_phoneoauth')
    return false;
  return true;
};