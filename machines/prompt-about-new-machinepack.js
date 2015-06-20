module.exports = {

  friendlyName: 'Prompt about new machinepack',
  description: 'Prompt command-line user for new machinepack details.',

  inputs: {},

  exits: {

    success: {
      description: 'Done.',
      example: {
        friendlyName: 'Passwords',
        identity: 'passwords',
        sentenceCaseFriendlyName: 'passwords',
        moduleName: 'machinepack-passwords',
        description: 'Work with passwords.'
      }
    },
    cancelled: {
      description: 'User cancelled the prompt (i.e. hit ^C)'
    },
    error: {
      description: 'An unexpected error occurred.'
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

    // `metadata` will hold the results.
    var metadata = {};

    var log = console.log;

    inquirer.prompt([
      {
        name: 'friendlyName',
        type: 'input',
        message: ''+
        'What would you like to use as the "friendly name" for your machinepack?\n'+
        chalk.gray('(e.g. "Passwords" or "Twitter")')+'\n'+
        '',
        validate: function (friendlyName){
          if (!_.isString(friendlyName) || !friendlyName) return;
          return true;
        }
      }
    ], function (answers) {

      // Save answers
      _.extend(metadata, answers);

      // Build a version of the friendlyName in sentence case.
      var sentenceCaseFriendlyName = metadata.friendlyName.replace(/(^[A-Z]|\s[A-Z])/g, function (match){
        return match.toLowerCase();
      });

      // Build identity by ecmascript-izing the friendly name
      var ecmascriptizedFriendlyName = metadata.friendlyName.replace(/[^0-9a-zA-Z]*/g,'');
      metadata.identity = ecmascriptizedFriendlyName.toLowerCase();

      // Then build the moduleName based on that
      metadata.moduleName = metadata.moduleName || 'machinepack-'+metadata.identity;

      // Expose sentenceCaseFriendlyName in result for convenience
      metadata.sentenceCaseFriendlyName = sentenceCaseFriendlyName;

      log('');
      log('The module will be named `%s`.', metadata.moduleName);
      log('');

      // Build default description
      var defaultDesc = 'Work with '+sentenceCaseFriendlyName+'.';

      inquirer.prompt([{
        name: 'description',
        type: 'input',
        message: 'Describe this machinepack in 80 characters or less.\n'+
        chalk.gray('(e.g. "Communicate with the Github API to get repos, commits, etc.")')+'\n',
        default: defaultDesc,
        validate: function (description){
          return !!description;
        }
      }], function (answers) {

        // Save answers
        _.extend(metadata, answers);

        log('');

        return exits.success(metadata);
      });
    });
  }
};
