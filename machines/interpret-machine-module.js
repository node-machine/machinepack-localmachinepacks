module.exports = {


  friendlyName: 'Interpret machine module',


  description: 'Interpret a machine from a Node.js module string into a JSON string.',


  extendedDescription: 'Functions will be escaped as strings.',


  inputs: {
    module: {
      description: 'The machine definition as a Node.js module (a string of JavaScript code).',
      example: 'module.exports = {inputs: {atest: {example: "whatever"    }  },  exits: {    error: {}, success: {example: {stuff: [{andMore: "stuff"        }]      }    }  },  fn: function(inputs, exits) {    return exits.success();  }};',
      required: true
    }
  },


  exits: {
    error: {
      description: 'Unexpected error occurred.'
    },
    noExits: {
      description: 'Machine definition is semantically invalid: No exits were provided'
    },
    tookTooLong: {
      description: 'Timed out attempting to interpret machine module.'
    },
    success: {
      description: 'Returns the machine definition as a JSON string.',
      variableName: 'jsonString',
      example: '((machine definition as a json string))'
    }
  },


  fn: function(inputs, exits) {

    var spawn = require('child_process').spawn;
    var path = require('path');
    var util = require('util');
    var debug = require('debug')('machine:interpret-machine-module');
    var _ = require('lodash');

    // Path to the parser
    var scriptPath = path.resolve(__dirname, "../helpers/parse-machine-spec.js");

    // Start the parser with proxies enabled
    var child = spawn("node", ["--harmony-proxies", scriptPath]);

    // Read in chunks of the result
    var result = '';
    child.stdout.on('readable', function() {
      var chunk = child.stdout.read();
      if (chunk !== null) {
        result += chunk;
      }
    });

    // When the child is finished, handle the exit status
    child.on('exit', finish);

    // Write to the parser stdin
    child.stdin.write(inputs.module);
    child.stdin.end();

    // Set a timeout to kill the parser after 2 seconds
    var timeout = setTimeout(function() {
      child.removeListener('exit', finish);
      child.kill();
      return exits.tookTooLong();
    }, 2000);

    function finish(code) {

      // Clear the timeout since the child is already done
      clearTimeout(timeout);

      // If we were unsuccessful, return the result as the error
      if (code !== 0) {
        return exits.error(result);
      }

      // Otherwise we were successful
      var machineMetadata;
      try {
        machineMetadata = JSON.parse(result);

        // If no exits exist at all in the def
        // (or they're invalid)
        if (!_.isObject(machineMetadata.exits)) {
          // If we're forcing it, just add an empty exits hash
          debug("Adding empty exits object to module with no exits defined.");
          machineMetadata.exits = {};
        }

        // If we're forcing it, make sure there are inputs in the machine def
        if (!machineMetadata.inputs) {
          debug("Adding empty inputs object to module with no inputs defined.");
          machineMetadata.inputs = {};
        }

        // Ensure `error` exit exists
        if (!machineMetadata.exits.error) {
          debug("Adding error exit to module with no error exit defined.");
          machineMetadata.exits.error = {
            description: "An unexpected error occurred."
          };
        }

        // Ensure success exit exists
        if (!machineMetadata.exits.success) {
          debug("Adding success exit to module with no success/default exit defined.");
          machineMetadata.exits.success = {
            description: "OK."
          };
        }

        // Remove the `id` property if one exists, because it is the primary key.
        // (this is mainly for backwards compatibility with machines that specify the `id` property.
        //  i.e. it should never be a big deal anymore)
        delete machineMetadata.id;

        // Loop through each exit and ensure that `error` and `sucess` have
        // at least a default description and a flag labeling them as the error
        // and/or default exit for convenience.
        machineMetadata.exits.error.description = 'An unexpected error occurred.';
        machineMetadata.exits.error.isCatchall = true;
        machineMetadata.exits.success.description = 'OK.';
        machineMetadata.exits.success.isDefault = true;


        // Loop through the machine metadata and determine the "type"
        // for each input and exit, saving it back onto the object.
        // This is just for display purposes (could be moved elsewhere-
        // but storing it in the db makes API usage and front-end code simpler.
        // Best thing to do is probably have the API mix these in at request-time.)
        _.each(machineMetadata.inputs, function(inputDef) {
          if (!_.isUndefined(inputDef.example)) {
            inputDef.type = _guessType(inputDef.example);
          } else if (!_.isUndefined(inputDef.typeclass)) {
            inputDef.type = inputDef.typeclass;
          }
        });
        _.each(machineMetadata.exits, function(exitDef) {
          if (!_.isUndefined(exitDef.example)) {
            exitDef.type = _guessType(exitDef.example);
          }
          // If exit has `getExample`, then the return value depends
          // on the configured inputs at runtime.  For now, we'll leave
          // the "type" unflagged in this case, but in the future, perhaps
          // registry browsers should have the ability to specify some input
          // configurations, which would make it possible to run getExample
          // and preview what type of data would come back.
          //
          // In an even simpler scenario, during import, we could try configuring
          // all inputs with their `example` (or a random piece of data of the expected typeclass)
          // and then running `getExample` based on that fake data.  In any case, for now,
          // we flag exits with a getExample function as `hasDynamicOutputType: true` so we can display
          // this in the UI one way or another.
          else if (!_.isUndefined(exitDef.getExample)) {
            exitDef.hasDynamicOutputType = true;
          } else if (exitDef.isCatchall) {
            exitDef.type = 'error';
          }
        });

      } catch (e) {
        return exits.error(e);
      }


      // If everything worked, return metadata wherein
      // the inputs/exits now have inferred types.
      // (but first, convert this to a JSON string)
      var jsonStr;
      try {
        jsonStr = JSON.stringify(machineMetadata);
      } catch (e) {
        return exits.error(e);
      }

      return exits.success(jsonStr);

    }

    function _guessType(value) {
      if (_.isArray(value)) {
        return 'array';
      }
      if (_.isObject(value)) {
        return 'object';
      }
      if (_.isNumber(value)) {
        return 'number';
      }
      if (_.isBoolean(value)) {
        return 'boolean';
      }
      if (_.isString(value)) {
        return 'string';
      }
      return '';
    }


  },

};
