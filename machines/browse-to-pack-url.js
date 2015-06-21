module.exports = {


  friendlyName: 'Browse to pack URL(s)',


  description: '',


  sync: true,


  inputs: {

    dir: {
      example: '/Users/mikermcneil/machinepack-foo/'
    },

    toWhat: {
      example: 'npm',
      defaultsTo: 'docs'
    }

  },


  exits: {
    error: {},
    notMachinepack: {},
    noNpmUrl: {},
    noSourceUrl: {},
    noGithubUrl: {},
    noDocsUrl: {},
    noTestsUrl: {},
    success: {
      example: 'http://node-machine.org/machinepack-facebook'
    },
  },


  fn: function (inputs, exits){

    var Machines = require('machinepack-localmachinepacks');
    var util = require('util');
    var browseToUrl = require('open');

    Machines.readPackageJson({
      dir: process.cwd()
    }).exec({
      error: exits.error,
      notMachinepack: exits.notMachinepack,
      success: function (machinepack){
        try {

          // TODO: perhaps add other convenient things? See synonyms in the case statement below.
          // Some of that could be broken up or added to.
          var ACCEPTABLE_BROWSE_TO_WHATS = ['docs', 'npm', 'source', 'tests'];
          inputs.toWhat = inputs.toWhat || 'docs';

          // TODO:
          // ideally, we'd ping the various urls w/ a HEAD request and check
          // for a 200 response before opening the browser for a better developer experience

          var url;

          switch(inputs.toWhat.toLowerCase()) {

            case 'docs':
            case 'doc':
            case 'documentation':
            case 'manpages':
            case 'manpage':
            case 'man':
            case 'wiki':
            case 'help':
              if (!machinepack.docsUrl) {
                return exits.noDocsUrl(new Error('This machinepack is not associated with a docs URL (e.g. the URL of a public machinepack on the public machine registry at http://node-machine.org.)'));
              }
              url = machinepack.docsUrl;
              break;

            case 'npm':
            case 'package':
            case 'release':
            case 'version':
            case 'module':
              if (!machinepack.npmUrl) {
                return exits.noNpmUrl(new Error('This machinepack is not associated with a Github repo, or any kind of source code repository at all.'));
              }
              url = machinepack.npmUrl;
              break;

            case 'source':
            case 'lib':
            case 'library':
            case 'history':
            case 'changes':
            case 'issues':
            case 'commits':
            case 'sourcecode':
            case 'repo':
            case 'repository':
            case 'implementation':
            case 'code':
            case 'remote':
              if (!machinepack.sourceUrl) {
                return exits.noSourceUrl(new Error('This machinepack is not associated with a version control (e.g. source code)'));
              }
              url = machinepack.sourceUrl;
              break;

            case 'github':
            case 'hub':
            case 'git':
              if (!machinepack.githubUrl){
                if (!machinepack.githubUrl && machinepack.sourceUrl){
                  return exits.noGithubUrl(new Error('This machinepack is not associated with a Github repo- but maybe try '+machinepack.sourceUrl));
                }
                return exits.noSourceUrl(new Error('This machinepack is not associated with a Github repo, or any other kind of version-control/source repository at all.'));
              }
              url = machinepack.githubUrl;
              break;

            case 'travis':
            case 'tests':
            case 'ci':
            case 'test':
            case 'status':
              if (!machinepack.testsUrl) {
                return exits.noTestsUrl(new Error('This machinepack does not have a `testsUrl`- make sure you run `mp scrub`, or manually add the url of your testing/continuous-integration thing to the `machinepack` object in your package.json file.'));
              }
              url = machinepack.testsUrl;
              break;

            default:
              return exits.error(buildError({
                format: ['`mp browse` works w/ no arguments, but if an argument IS provided, it must be one of the following:', ACCEPTABLE_BROWSE_TO_WHATS]
              }));
          }

          browseToUrl(url);
          return exits.success(url);
        }
        catch (e) {
          return exits(e);
        }
      }
    });
  }



};



/**
 * Warning: this is not a machine!
 */

function buildError ( /* [opts or error message], <<...if first arg is string, additional args like you would pass to util.format...>> */) {

  var util = require('util');
  var _ = require('lodash');

  var _err;

  if (_.isString(arguments[0])) {
    _err = new Error(util.format.apply(util, Array.prototype.slice.call(arguments)));
    return _err;
  }
  if (_.isObject(arguments[0])) {

    // Use `message` if provided
    // (cast to string)
    if (!_.isUndefined(arguments[0].message)) {
      _err = new Error(arguments[0].message+'');
    }
    // Or if `format` array is provided, build `message` from it instead
    // (cast to string)
    else if (_.isArray(arguments[0].format)) {
      _err = new Error(util.format.apply(util, arguments[0].format)+'');
    }
    // If neither is provided, just set up an empty error
    else {
      _err = new Error();
    }

    // Use `status` if provided
    // (cast to number)
    if (!_.isUndefined(arguments[0].status) && !_.isNaN(+arguments[0].status)) {
      _err.status = +arguments[0].status;
    }

    // Use `exit` if provided, otherwise leave it undefined.
    // Also use it to set the `code`.
    if (!_.isUndefined(arguments[0].exit)){
      _err.exit = arguments[0].exit+'';
      _err.code = _err.exit;

      // Also set the `type` property to whatever `code` is
      _err.type = _err.code;
    }

    // Set the `code` property if provided.
    // (cast to string)
    if (!_.isUndefined(arguments[0].code)) {
      _err.code = arguments[0].code;
      _err.code = _err.code + '';

      // Also set the `type` property to whatever `code` is
      _err.type = _err.code;
    }
    return _err;
  }

  // If the args are all weird for some reason, just return.
  return new Error();
}
