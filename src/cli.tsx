#!/usr/bin/env node
import React from 'react';
import {Command} from 'commander';
import {render} from 'ink';
import {addCommand} from './commands/add.js';
import {listCommand} from './commands/list.js';
import {removeCommand} from './commands/remove.js';
import {useCommand} from './commands/use.js';
import {UserCancelled} from './prompts/select-deck.js';
import {App} from './tui/app.js';

async function runTui(): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('The full-screen UI requires a TTY. Use `skdeck --help` for non-interactive environments.');
  process.stdout.write('\x1b[?1049h\x1b[?25l');
  const instance = render(<App/>, {exitOnCtrlC: true});
  try { await instance.waitUntilExit(); }
  finally {
    process.stdout.write('\x1b[?25h\x1b[?1049l');
  }
}

const program = new Command()
  .name('skdeck')
  .description('Manage versioned Agent Skills as reusable Decks')
  .version('0.1.0')
  .option('-p, --project <path>', 'project directory', process.cwd());

program.command('add <github-url>').description('discover and import Skills from GitHub').action(addCommand);
program.command('use [deck]').description('preview and apply a Deck').option('-p, --project <path>', 'project directory', process.cwd()).action((deck, options) => useCommand(deck, options.project));
program.command('remove [deck]').description('safely remove a Deck').option('-p, --project <path>', 'project directory', process.cwd()).action((deck, options) => removeCommand(deck, options.project));
program.command('list').description('list the Library and Decks').action(listCommand);
program.action(runTui);

program.parseAsync().catch(error => {
  if (error instanceof UserCancelled) return;
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
