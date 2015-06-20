module.exports = {


  friendlyName: 'Add test',


  description: 'Add a test for a machine in a machinepack on the local disk.',


  inputs: {

    dir: {
      description: 'The path to the machinepack (if path is not absolute, will be resolved from the current working directory)',
      example: '/Users/mikermcneil/machinepack-foo/',
      required: true
    },

    identity: {
      description: 'The identity of the machine for whom a test will be generated.',
      example: 'do-stuff-and-things',
      required: true
    },

    using: {
      description: 'An input configuration for this machine.',
      example: {},
      required: true
    },

    outcome: {
      description: 'Expected outcome (exit triggered) from the provided input configuration.',
      example: 'foobar',
      required: true
    },

    returns: {
      description: 'Expected return value from the provided input configuration.',
      example: '*'
    },

    before: {
      description: 'A stringified function that will be used as the "before" for Mocha.',
      example: 'function before (done) {\n done(); \n}'
    },

    after: {
      description: 'A stringified function that will be used as the "after" for Mocha.',
      example: 'function after (done) {\n done(); \n}'
    }

  },


  exits: {

    corrupted: {
      description: 'A test suite file exists, but it is corrupted.  Please fix or delete it manually.',
      example: '/foo/bar/machinepack-baz/tests/do-stuff-and-things.json'
    },

    success: {
      description: 'Test suite was successfully updated.'
    }

  },


  fn: function (inputs, exits){

    var path = require('path');
    var _ = require('lodash');
    var Util = require('machinepack-util');
    var Filesystem = require('machinepack-fs');

    var pathToTests = path.resolve(inputs.dir, './tests');
    var pathToTestSuite = path.resolve(pathToTests, inputs.identity+'.json');

    // Build up new test data
    var newExpectation = {
      using: inputs.using,
      outcome: inputs.outcome
    };
    if (!_.isUndefined(inputs.returns)) {
      newExpectation.returns = inputs.returns;
    }
    // Add before and/or after stringified fns if relevant
    if (inputs.before) {
      newExpectation.before = inputs.before;
    }
    if (inputs.after) {
      newExpectation.after = inputs.after;
    }

    // Generate unique string from the provided config (`using`).
    var newExpectationConfigHash = Util.hashDictionary({
      dictionary: inputs.using,
    }).execSync();

    // console.log('reading test suite from %s',pathToTestSuite);

    // Load test suite from disk, or write a JSON file for it
    // if one doesn't already exist
    Filesystem.ensureJson({
      path: pathToTestSuite,
      schema: {
        machine: inputs.identity,
        expectations: []
      }
    }).exec({
      error: function (err){
        return exits.error(err);
      },
      couldNotParse: function (){
        return exits.corrupted(pathToTestSuite);
      },
      success: function (suite){

        // check each test against the provided config
        var matchingExpectation = _.find(suite.expectations, function (expectation){
          var hash = Util.hashDictionary({
            dictionary: expectation.using,
          }).execSync();
          return newExpectationConfigHash === hash;
        });

        // if configs DON'T match, add a new test
        if (!matchingExpectation) {
          delete newExpectation.todo;
          suite.expectations.push(newExpectation);
        }
        // if configs match, update the test expectations
        else {
          delete matchingExpectation.todo;
          matchingExpectation.outcome = newExpectation.outcome;
          if (_.isUndefined(newExpectation.returns)) {
            delete matchingExpectation.returns;
          }
          else {
            matchingExpectation.returns = newExpectation.returns;
          }
          // Add before and/or after stringified fns if relevant
          if (inputs.before) {
            matchingExpectation.before = inputs.before;
          }
          if (inputs.after) {
            matchingExpectation.after = inputs.after;
          }

          // Don't write fns if they don't exist
          if (!matchingExpectation.before) {
            delete matchingExpectation.before;
          }
          if (!matchingExpectation.after) {
            delete matchingExpectation.after;
          }
        }

        // Clean out `todo` test stubs
        suite.expectations = _.reject(suite.expectations, function (expectation){
          return !!expectation.todo;
        });

        // Finally, write test suite back to disk
        Filesystem.writeJson({
          json: suite,
          destination: pathToTestSuite,
          force: true
        }).exec({
          error: exits.error,
          success: function (){
            return exits.success();
          }
        });
      }
    });

  }

};




