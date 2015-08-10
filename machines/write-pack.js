module.exports = {


  friendlyName: 'Write machinepack',


  description: 'Write a machinepack to disk at the specified path using the given metadata.',


  inputs: {

    destination: {
      description: 'The path to the machinepack (if path is not absolute, will be resolved from the current working directory)',
      example: '/Users/mikermcneil/machinepack-foo/',
      required: true
    },

    packData: {
      description: 'The metadata and code for the machinepack and its machines.',
      example: {},
      required: true
    },

    force: {
      description: 'Whether to force/overwrite files that already exist at the destination',
      example: true,
      defaultsTo: false
    },

    ensureMachineDep: {
      description: 'Whether or not to add a dependency on `machine` to the generated pack if it doesn\'t have one.  Enabled by default.',
      example: true,
      defaultsTo: true,
    },

    mergeDependencies: {
      description: 'Whether the dependencies in the pack data should merge on top of existing dependencies (if any) instead of overwriting them',
      example: true,
      defaultsTo: false
    }

  },


  exits: {

    alreadyExists: {
      description: 'A file or folder already exists at the destination path.',
      example: '/Users/mikermcneil/code/foo'
    }

  },


  fn: function(inputs, exits) {

    var path = require('path');
    var async = require('async');
    var _ = require('lodash');
    var rttc = require('rttc');
    var Filesystem = require('machinepack-fs');
    var NPM = require('machinepack-npm');
    var Javascript = require('machinepack-javascript');
    var thisPack = require('../');


    // `packData` contains basic metadata about the machinepack as well as
    // complete metadata about each machine-- including the `fn` (implementation code)
    var packData = inputs.packData;

    // Ensure packData is valid using an example schema.
    packData = rttc.coerce(rttc.infer({
      friendlyName: 'Foo',
      description: 'Node.js utilities for working with foos.',
      author: 'Marty McFly <marty@mcfly.com>',
      license: 'MIT',
      version: '0.5.17',
      id: 'marty/machinepack-do-stuff',
      npmPackageName: '@treelinehq/marty/machinepack-do-stuff',
      dependencies: [ { name: 'lodash', semverRange: '^2.4.1' } ],
      postInstallScript: 'node ./postinstall.js',
      indexJsCode: 'module.exports = require(\'machinepack-util\');',
      machines: [{
        identity: 'do-stuff',
        friendlyName: 'Do stuff',
        description: 'Do stuff given other stuff.',
        extendedDescription: 'Do stuff to the stuff given the other stuff.  If the stuff doesn\'t get done the first time, try it again up to 50 times using an exponential backoff strategy.',
        moreInfoUrl: 'http://place-with-more-info.com',
        cacheable: false,
        sync: false,
        idempotent: false,
        environment: ['sails'],
        inputs: {}, //=> { foo: { friendlyName: 'Foo', example: 'bar' } }
        exits: {}, //=>{ error: { friendlyName: 'error', example: null } }
        fn: '/*the stringified machine fn contents, without the function signature*/',
      }]
    }), rttc.dehydrate(packData, true));
    // ^Note that we dehydrate before coercing in order to ensure functions are stringified.

    // Just in case...
    // (i) Lowercase the machine identities
    packData.machines = _.map(packData.machines, function (machineDef){
      machineDef.identity = machineDef.identity.toLowerCase();
      return machineDef;
    });
    // (ii) Also ensure none of the machines now have duplicate identities
    //      (if so, then remove them)
    packData.machines = _.uniq(packData.machines, 'identity');

    // (iii) Use the `id` as the npm package name if no package name is provided:
    packData.npmPackageName = packData.npmPackageName || packData.id;

    // TODO: enforce all 4 things (^^) in the API when `npmPackageName`s
    // are initially set or modified (including if/when they are inferred)

    // Names with > 1 level of path separators are not permitted, so transform
    // them with dashes
    var npmPackageNamePieces = packData.npmPackageName.split('/');
    if (npmPackageNamePieces.length > 1) {
      packData.npmPackageName = npmPackageNamePieces.shift() + '/' + npmPackageNamePieces.join('--');
    }

    // Names with > 0 level of path separators need an @ symbol at the top
    if (packData.npmPackageName.split('/').length > 1 && packData.npmPackageName[0] !== '@') {
      packData.npmPackageName = '@' + packData.npmPackageName;
    }

    // Determine the dictionary that will become the package.json file.
    var pkgMetadata = {
      name: packData.npmPackageName,
      private: true,
      version: packData.version || '0.1.0',
      description: packData.description || '',
      keywords: [
        packData.friendlyName,
        'machines',
        'machinepack'
      ],
      author: packData.author,
      license: packData.license,
      dependencies: NPM.unarrayifyDependencies({
        dependencies: packData.dependencies
      }).execSync(),
      devDependencies: {},
      scripts: {},
      machinepack: {
        id: packData.id,
        friendlyName: packData.friendlyName,
        machineDir: 'machines/',
        machines: _.pluck(packData.machines, 'identity')
      }
    };


    // If `postInstallScript` is provided and not an empty string,
    // then compile a postinstall script directly in the package.json file.
    if (inputs.packData.postInstallScript) {
      pkgMetadata.scripts.postinstall = inputs.packData.postInstallScript;
    }

    var packageJsonPath = path.resolve(inputs.destination,'package.json');

    // If we're being asked to merge the dependencies sent with the changelog into the existing
    // package.json dependencies dict, do so here (this is why we keep a separate dict under
    // the "machinepack" key).  This way we don't lose things like Sails project dependencies.
    if (inputs.mergeDependencies) {
      try {
        delete require.cache[packageJsonPath];
        pkgMetadata.dependencies = _.extend({}, require(packageJsonPath).dependencies, pkgMetadata.dependencies);
      }
      catch(e) {}
    }

    // (iv) Ensure `machine` is included as an NPM dependency, unless this check
    //      is explicitly disabled.
    if (inputs.ensureMachineDep) {
      if (!pkgMetadata.dependencies.machine) {
        pkgMetadata.dependencies.machine = '^11';
      }
    }

    // Write the package.json file (and the empty folder)
    Filesystem.writeJson({
      destination: packageJsonPath,
      json: pkgMetadata,
      force: inputs.force
    }).exec({
      error: exits.error,
      alreadyExists: function (){
        return exits.alreadyExists(packageJsonPath);
      },
      success: function (){

        // Now write an `index.js` file.
        var indexJsPath = path.resolve(inputs.destination,'index.js');

        // If custom `indexJsCode` was provided and is not an empty string (""),
        // write _it_ instead of the default (this is useful for things like aliasing
        // other packs, exporting packs w/ browserify support, etc.)
        packData.indexJsCode = packData.indexJsCode || '// This is a boilerplate file which should not need to be changed.\nmodule.exports = require(\'machine\').pack({\n  pkg: require(\'./package.json\'),\n  dir: __dirname\n});\n';

        Filesystem.write({
          destination: indexJsPath,
          string: packData.indexJsCode,
          force: inputs.force
        }).exec({
          error: exits.error,
          alreadyExists: function (){
            return exits.alreadyExists(indexJsPath);
          },
          success: function() {

            // Loop over each machine in the pack
            async.each(packData.machines, function (thisMachine, next){

              // If this machine has been marked as already existing in the location,
              // we can skip it.
              if (thisMachine.unchanged) {
                return next();
              }

              try {
                // Determine the path where the new module will be written
                var machineModulePath = path.resolve(inputs.destination, 'machines', thisMachine.identity+'.js');

                // and the code that it will consist of:
                // (build a JavaScript code string which represents the provided machine metadata)
                var machineModuleCode = thisPack.buildMachineCode({
                  friendlyName: thisMachine.friendlyName || thisMachine.identity,
                  description: thisMachine.description,
                  extendedDescription: thisMachine.extendedDescription,
                  moreInfoUrl: thisMachine.moreInfoUrl,
                  cacheable: thisMachine.cacheable,
                  environment: thisMachine.environment,
                  sync: thisMachine.sync,
                  inputs: thisMachine.inputs,
                  exits: thisMachine.exits,
                  fn: thisMachine.fn
                }).execSync();

                // Write the machine file
                Filesystem.write({
                  destination: machineModulePath,
                  string: machineModuleCode,
                  force: inputs.force
                }).exec({
                  error: function (err) {
                    return next(err);
                  },
                  success: function (){
                    return next();
                  }
                });//</Filesystem.write>
              }
              catch (e) {
                return next(e);
              }
            }, function afterwards(err) {
              if (err) {
                return exits.error(err);
              }
              return exits.success();
            });//</async.each>
          }
        }); // </write index.js file>

      }
    });//</Filesystem.writeJson>


  },

};
