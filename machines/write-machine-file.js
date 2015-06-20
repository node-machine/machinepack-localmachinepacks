module.exports = {

  friendlyName: 'Write machine file',

  description: 'Write a new machine file to disk at the specified path.',

  inputs: {

    destination: {
      description: 'The output path where the machine should be written',
      example: '/Users/mikermcneil/machinepack-foobar/machines/some-machine.js',
      required: true
    },

    friendlyName: {
      description: 'The human-readable label for this machine.  Should be short (<5 words, <50 characters) and written in the imperative mood.',
      extendedDescription: '"Imperative mood" means that the description should be written as a command, not a remark.  In other words, a machine that charges a credit card should have a description that begins: "Charge the specified...", not: "Charges the specified..."',
      example: 'Do something',
    },

    description: {
      description: 'A clear, 1-sentence description (< 80 characters) of what this machine does.',
      extendedDescription: '"Imperative mood" means that the description should be written as a command, not a remark.  In other words, a machine that charges a credit card should have a description that begins: "Charge the specified...", not: "Charges the specified..."',
      example: 'Do something useful given stuff; maybe return something else.',
    },

    moreInfoUrl: {
      description: 'A URL with supplemental information about this machine',
      extendedDescription: 'This optional URL points to somewhere (other than http://node-machine.org) where additional information about the underlying functionality in this machine can be found. Particularly helpful for machines that communicate with 3rd-party APIs like Twitter or Stripe. Be sure and use a fully qualified URL like http://foo.com/bar/baz.',
      example: 'http://api.stuff.org/foo/bar?v=3.1'
    },

    extendedDescription: {
      description: 'A markdown string providing additional details about this machine.',
      extendedDescription: 'Provides supplemental info on top of description. Full markdown syntax with complete sentences (including punctuation). Should be less than 2000 characters.  Use cases generally include technical notes, details on how the machine works, or considerations/caveats like rate-limiting.',
      example: '...lots of words...',
    },

    sync: {
      description: 'A flag indicating that this machine is immediate (i.e. executes synchronously / blocks)',
      extendedDescription: 'If `sync` is set to true, **every exit** of this machine should be execute synchronously (i.e. <1 tick of the event loop).  If `sync` is enabled, in addition to standard usage (i.e. `.exec()`) users will be able to call `.execSync()` on instances of this machine.',
      example: true
    },

    cacheable: {
      description: 'A flag indicating whether or not this machine is cacheable',
      extendedDescription: 'Should only be enabled if this machine has no "side effects". This is sometimes called "referential transparency" or "nullipotence".  For instance, fetching a list of tweets which contain a particular hashtag _is_ cacheable, whereas posting a tweet or updating a Twitter user account _is not_.  Another example is a SELECT query in a SQL database; it returns useful data, but does not change the data structure queried.  If `cacheable` is enabled, users will be able to call `.cache()` on instances of this machine.',
      example: true
    },

    idempotent: {
      description: 'A flag indicating whether or not this machine is idempotent',
      example: true
    },

    inputs: {
      description: 'A dictionary specifying the inputs that the machine accepts at runtime.',
      example: {}
    },

    exits: {
      description: 'A dictionary specifying the exit scenarios played out by the machine at runtime.',
      example: {}
    }
  },

  exits: {
    error: {
      description: 'Unexpected error occurred.',
    },
    alreadyExists: {
      description: 'Something already exists at destination path (probably another machine with the same identity)'
    },
    success: {
      description: 'Done.'
    }
  },

  fn: function (inputs, exits){

    /**
     * Module dependencies
     */

    var Path = require('path');
    var _ = require('lodash');
    var Filesystem = require('machinepack-fs');
    var Machine = require('machine');
    var _buildMachineCode = Machine.build(require('./build-machine-code'));


    // Build the code string that will be written to disk
    _buildMachineCode({
      friendlyName: inputs.friendlyName,
      description: inputs.description,
      extendedDescription: inputs.extendedDescription,
      moreInfoUrl: inputs.moreInfoUrl,
      inputs: inputs.inputs,
      exits: inputs.exits,
      cacheable: inputs.cacheable,
      sync: inputs.sync,
      idempotent: inputs.idempotent
    }).exec({
      error: function (err){
        return exits.error(err);
      },
      success: function (codeStr){

        // Generate a file on the local filesystem using the specified utf8 string as its contents.
        Filesystem.write({
          string: codeStr,
          destination: inputs.destination,
          force: false
        }).exec({

          error: function (err){
            return exits.error(err);
          },

          // Something already exists at the specified path (overwrite by enabling the `force` input)
          alreadyExists: function (){
            return exits.alreadyExists(new Error('Something already exists at '+inputs.destination));
          },

          success: function (){
            return exits.success();
          }
        });
      }
    });

  }
};
