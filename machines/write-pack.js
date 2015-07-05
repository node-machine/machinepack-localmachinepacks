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
        cacheable: false,
        sync: false,
        idempotent: false,
        inputs: {}, //=> { foo: { friendlyName: 'Foo', example: 'bar' } }
        exits: {}, //=>{ error: { friendlyName: 'error', example: null } }
        fn: '/*the stringified machine fn contents, without the function signature*/',
      }]
    }), packData);

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
      dependencies: _.reduce(packData.dependencies, function (memo, dependency) {
        memo[dependency.name] = dependency.semverRange;
        return memo;
      }, {
        machine: '^10.0.0'
      }),
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

    // Write the package.json file (and the empty folder)
    var packageJsonPath = path.resolve(inputs.destination,'package.json');
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

              try {
                // Determine the path where the new module will be written
                var machineModulePath = path.resolve(inputs.destination, 'machines', thisMachine.identity+'.js');

                // and the code that it will consist of:
                // (build a JavaScript code string which represents the provided machine metadata)
                var machineModuleCode = thisPack.buildMachineCode({
                  friendlyName: thisMachine.friendlyName || thisMachine.identity,
                  description: thisMachine.description,
                  extendedDescription: thisMachine.extendedDescription,
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
