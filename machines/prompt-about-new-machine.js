module.exports = {

  friendlyName: 'Prompt about new machine',

  description: 'Prompt command-line user for details about a new machine being created.',

  inputs: {
    identity: {
      example: 'do-something'
    }
  },

  exits: {
    error: {
      description: 'Unexpected error occurred.',
    },
    success: {
      description: 'Done.',
      example: {
        identity: 'do-something',
        friendlyName: 'Do something',
        description: 'Do something useful given stuff; maybe return something else.',
        extendedDescription: '...lots of words...',
        methodName: 'doSomething'
      }
    }
  },

  fn: function (inputs, exits){

    /**
     * Module dependencies
     */

    var inquirer = require('inquirer');
    var chalk = require('chalk');
    var _ = require('lodash');
    var Path = require('path');
    var Javascript = require('machinepack-javascript');



    // `metadata` will hold the results.
    var metadata = {};

    var log = console.log;

    inquirer.prompt([
      {
        name: 'friendlyName',
        type: 'input',
        message: ''+
        'What would you like to use as the "friendly name" for your new machine?\n'+
        chalk.gray('(e.g. "Get auth token" or "Delete account")')+'\n'+
        '',
        validate: function (friendlyName){
          if (!_.isString(friendlyName) || !friendlyName) return;
          return true;
        }
      }
    ], function (answers) {
      // Save answers
      _.extend(metadata, answers);

      // Build identity by lowercasing and dash-delimiting the friendly name.
      metadata.identity = (inputs.identity || metadata.friendlyName).replace(/\s+\S/g,function (match){
        return match.replace(/^\s/,'-');
      });
      metadata.identity = metadata.identity.toLowerCase();

      // Given a string of dash-delimited words, return a similar version of the string, but which is camel-cased and otherwise stripped of special characters, whitespace, etc. so that it is usable as an ECMAScript variable.
      Javascript.convertToEcmascriptCompatibleVarname({
        string: metadata.identity
      }).exec({

        error: function (err){
          return exits.error(err);
        },

        success: function (methodName){

          // Save ecmascript-ized identity as `methodName`
          metadata.methodName = methodName;

          log('');
          log('The machine\'s identity will be `%s`', metadata.identity);
          log('which means you\'ll use it as:  `.%s()`', metadata.methodName);
          log('');

          // Build a version of the friendlyName in sentence case.
          var sentenceCaseFriendlyName = metadata.friendlyName.replace(/(^[A-Z]|\s[A-Z])/g, function (match){
            return match.toLowerCase();
          });
          // Expose sentenceCaseFriendlyName in result for convenience
          metadata.sentenceCaseFriendlyName = sentenceCaseFriendlyName;

          inquirer.prompt([
            {
              name: 'description',
              type: 'input',
              message: 'Describe this machine in 80 characters or less (optional)\n'+
              chalk.gray('(e.g. "List all Twitter followers for a particular account.")')+'\n'
            },
            {
              name: 'extendedDescription',
              type: 'input',
              message: 'Provide a more in-depth description of the machine (optional)'
            }
          ], function (answers) {

            // Save answers
            _.extend(metadata, answers);

            log('');

            return exits.success(metadata);
          });
        },
      });
    });
  }
};
