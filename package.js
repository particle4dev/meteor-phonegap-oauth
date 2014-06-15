Package.describe({
  summary: 'Meteor OAuth with Phonegap'
});

Package.on_use(function (api) {
	api.use('oauth', ['client', 'server']);
	api.use(['routepolicy', 'webapp'], ['server']);
  	api.add_files(["oauth_patch.js"], "client");
  	api.add_files(["oauth_server.js"], "server");
});