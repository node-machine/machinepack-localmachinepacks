module.exports = {


  friendlyName: 'Get signature',


  description: 'Lookup top-level metadata, dehydrate the machine definitions, and compute a hash for the public API of this machinepack.',


  cacheable: true,


  inputs: {

    dir: {
      description: 'The path to the machinepack (if path is not absolute, will be resolved from the current working directory)',
      example: '/Users/mikermcneil/machinepack-foo/',
      required: true
    }

  },


  exits: {

    success: {
      variableName: 'result',
      example: {
        pack: {},
        machines: [{}],
        packHash: 'a8319azj39$29130nfan3',
        machineHashes: [{
          machine: 'some-machine-identity',
          hash: '1390ba9z9140$1-3a914n4'
        }],
        npmDependencies: [{
          name: 'lodash',
          semverRange: '^3.9.0'
        }]
      },
      description: 'Done.',
    },

  },


  fn: function (inputs,exits) {

    var path = require('path');
    var Arrays = require('machinepack-arrays');
    var JSON = require('machinepack-json');
    var Util = require('machinepack-util');
    var _ = require('lodash');
    var thisPack = require('../');

    // Resolve absolute path
    inputs.dir = path.resolve(process.cwd(), inputs.dir);

    // Read local pack
    thisPack.readPackageJson({
      dir: inputs.dir
    }).exec({
      error: exits.error,
      success: function(packMetadata) {

        // Run some logic (the "iteratee") once for each item of an array.
        Arrays.map({
          array: packMetadata.machines,
          itemExample: {},
          iteratee: function(_inputs, _exits) {

            var machineIdentity = _inputs.item;

            // Read machine file located at the specified path into a JSON string w/ stringified functions.
            thisPack.readMachineFile({
              source: path.resolve(inputs.dir, packMetadata.machineDir, machineIdentity + '.js')
            }).exec({
              error: function (err) {
                // If an expected machine module is corrupted (i.e. it was referenced by
                // `machinepacks.machines` in the package.json file, but the file is all
                // jacked up), then ignore it, but also log a warning.
                console.warn('Ignoring local machine ('+machineIdentity+') b/c it seems to be corrupted. Details:\n',err);
                return _exits.exclude();
              },
              notFound: function (){
                // If an expected machine module is missing (i.e. it was referenced by
                // `machinepacks.machines` in the package.json file), then just ignore it.
                return _exits.exclude();
              },
              success: function (jsonStr){
                // Parse machine data from the JSON-encoded string.
                JSON.parse({
                  json: jsonStr,
                  schema: {},
                }).exec({
                  error: _exits.error,
                  success: function  (machineDef) {
                    // Make sure machineDef has an identity:
                    machineDef.identity = machineDef.identity || machineIdentity;

                    return _exits.success(machineDef);
                  }
                });
              }
            });
          }//</iteratee>

        }).exec({
          error: exits.error,
          success: function(machineDefs) {

            Arrays.map({
              array: machineDefs,
              itemExample: {
                machine: 'some-machine-identity',
                hash: 'a193fha9319vazm31$139a0'
              },
              iteratee: function(_inputs, _exits) {
                var hash = Util.hash({ value: _inputs.item }).execSync();
                return _exits.success({
                  hash: hash,
                  machine: _inputs.item.identity
                });
              }
            }).exec({
              error: exits.error,
              success: function (machineHashes){
                var hashObj = {
                  "identity": packMetadata.npmPackageName,
                  "friendlyName": packMetadata.friendlyName,
                  "description": packMetadata.description,
                  "author": packMetadata.author,
                  "license": packMetadata.license,
                  "dependencies": packMetadata.machineDependencies,
                  "machines": _.pluck(machineHashes, 'hash')
                };
                // Generate unique hash for each machine, and for the top-level pack metadata.
                Util.hash({
                  value: hashObj,
                }).exec({
                  error: exits.error,
                  success: function(packHash){
                    // The pack-specific dependencies may be stored in the machinepack.dependencies
                    // key of the package.json.  Having them stored in a place separate from the
                    // package.json dependencies dictionary allows us to operate on them with changelogs
                    // without affecting other required dependencies that are not part of the pack
                    // (e.g. sails and its dependencies, for Treeline apps)
                    var npmDependencies = packMetadata.machineDependencies || [];
                    return exits.success({
                      pack: packMetadata,
                      machines: machineDefs,
                      machineHashes: machineHashes,
                      packHash: packHash,
                      npmDependencies: npmDependencies
                    });
                  }
                });
              }
            });

          }
        });

      }
    });
  }


};
