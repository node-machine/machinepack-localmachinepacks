module.exports = {
  friendlyName: 'Run local machine (interactive)',
  description: 'Run a machine in the specified local pack, prompting for required input values.',
  extendedDescription: '',
  inputs: {
    machinepackPath: {
      example: '/Users/mikermcneil/machinepack-foo/machines/bar.js',
      description: 'The path to the machinepack this machine is a part of (if path is not absolute, will be resolved from the current working directory)',
      required: true
    },
    identity: {
      example: 'foo-bar',
      description: 'The identity of the machine to run.',
      required: true
    },
    inputValues: {
      description: 'A set of input values (interactive prompt will be skipped for required inputs provided this way)',
      example: [{
        name: 'someInput',
        value: 'some configured string value for the input',
        protect: false
      }]
    }
  },
  exits: {
    error: {
      description: 'Unexpected error occurred.'
    },
    notFound: {
      description: 'No file exists at the specified path'
    },
    invalidMachine: {
      description: 'Invalid machine definition'
    },
    success: {
      description: 'Returns object representing the action that was taken.',
      example: {
        withInputs: [
          {
            name: 'foobar',
            protect: false,
            value: 'fiddle diddle'
            // ^^^^^ this is ok because it's always a string entered on the CLI interactive prompt
          }
        ],
        exited: {
          outcome: 'success',
          output: '===',
          jsonStringifiedOutput: '{"stuff": "things"}',
          inspectedOutput: '{ stuff: "things" }',
          duration: 2582
        }
      }
    }
  },
  fn: function(inputs, exits) {

    // Dependencies
    var _ = require('lodash');
    var async = require('async');
    var Machine = require('machine');
    var chalk = require('chalk');
    var rttc = require('rttc');


    // `inputValues` defaults to an empty array
    inputs.inputValues = inputs.inputValues||[];

    // Require the machinepack
    var mp;
    try {
      mp = require(inputs.machinepackPath);
    }
    catch (e) {
      return exits.error(e);
    }

    // Look up the appropriate machine instance
    var machineInstance;
    _.each(mp, function (_machine, methodName) {
      if (_machine.identity === inputs.identity) {
        machineInstance = _machine;
      }
    });
    if (!machineInstance) {
      return exits.notFound();
    }

    // Now we need to acquire configured input values from the user
    // (for all required inputs at *minimum*)

    // Build an array of all the required inputs, formatted for use
    // w/ `prompt-for-input-vals`.
    var requiredInputPrompts = [];
    _.each(machineInstance.inputs, function (inputDef, inputName) {
      if (inputDef.required) {

        var promptDef = {};
        promptDef.name = inputName;
        promptDef.description = inputDef.description||'';
        promptDef.example = (function (){
          if (_.isArray(inputDef.example) || _.isObject(inputDef.example)){
            var stringifiedExample;
            try {
              stringifiedExample = JSON.stringify(inputDef.example);
            }
            catch (e) { stringifiedExample = _.isArray(inputDef.example)?'[]':'{}'; }
            return stringifiedExample;
          }
          return inputDef.example||'';
        })();
        promptDef.typeclass = inputDef.typeclass || '';

        // Determine input type to expect
        if (inputDef.typeclass === '*' || inputDef.typeclass === 'dictionary' || inputDef.typeclass === 'array' || _.isArray(inputDef.example) || _.isObject(inputDef.example) || inputDef.example === '===' || inputDef.example === '*') {
          promptDef.expectType = 'json';
        }
        else if (inputDef.protect){
          promptDef.expectType = 'password';
        }
        else {
          promptDef.expectType = 'string';
        }

        requiredInputPrompts.push(promptDef);
      }
    });

    // Remove required inputs that are already defined in inputValues
    _.remove(requiredInputPrompts, function (requirement) {
      return !!_.find(inputs.inputValues, {name: requirement.name});
    });

    // Prompt for required inputs
    Machine.build(require('./prompt-for-input-vals'))({
      prompts: requiredInputPrompts
    }).exec({
      error: function (err) {
        return exits.error(err);
      },
      success: function (promptAnswers){

        // Now add the explicitly declared `inputValues` from above into our prompt answers.
        _.each(inputs.inputValues, function (inputValue){
          promptAnswers.unshift({name: inputValue.name, value: inputValue.value});
        });

        // Save a copy of original input values for use in generating `--` CLI opts
        var originalInputVals = _.cloneDeep(promptAnswers);

        // Now we'll decode each input value (since they're all strings at the moment)
        promptAnswers = _.reduce(promptAnswers, function (memo, inputValue){

          // Ignore values specified for unknown inputs
          var inputDef = machineInstance.inputs[inputValue.name];
          if (!inputDef) {
            return memo;
          }

          // Determine the type schema for the provided input value based
          // on the input definition's expectations
          // (i.e. if example or typeclass is an array or dictionary)
          var typeSchema;
          try {
            // Special handling for typeclasses
            // TODO: remove this when typeclass is officially deprecated
            if (inputDef.typeclass === 'dictionary') {
              typeSchema = {};
            }
            else if (inputDef.typeclass === 'array') {
              typeSchema = [];
            }
            else if (inputDef.typeclass) { // typeclass: *, etc
              typeSchema = 'ref';
            }
            // Normal case type inference (from example):
            else {
              typeSchema = rttc.infer(inputDef.example);
            }
          }
          catch (e) {
            // could not infer type
            // (machine runner will catch this as an error in a moment, but no need to worry right now)
          }

          // Now parse the human-entered input string, but use the type schema to improve our guess.
          var parsedValue;
          try {
            parsedValue = rttc.parseHuman(inputValue.value, typeSchema, true);
          }
          catch (e) {
            // could not parse value-
            // this should never happen, because it should be checked when accepting
            // prompt values.
            console.warn('Consistency violation in run-machine-interactive: could not parse machine input value ('+inputValue.name+').\nError details:\n',e);
          }

          memo.push({name: inputValue.name, value: parsedValue});
          return memo;
        }, []);

        Machine.build(require('./run-machine'))({
          machinepackPath: inputs.machinepackPath,
          identity: inputs.identity,
          inputValues: promptAnswers
        }).exec({
          error: exits.error,
          notFound: exits.notFound,
          invalidMachine: exits.invalidMachine,
          success: function (result){

            // Now loop through the original prompt answers one more time and strip out sensitive
            // input data that was flagged with `expectType: "password"` in the original
            // `requiredInputPrompts`.
            _.each(originalInputVals, function (answer){
              var isProtected = !!_.find(requiredInputPrompts, {
                name: answer.name,
                expectType: 'password'
              });
              if (isProtected) {
                answer.value = '[**protected**]';
                answer.protect = true;
              }
            });

            return exits.success({
              withInputs: originalInputVals,
              exited: result
            });
          }
        });
      }
    });
  },

};
