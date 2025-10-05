/**
 * Test script to verify LM Studio connection
 */

import OpenAI from 'openai';
import chalk from 'chalk';
import { CONFIG } from './config.js';

const log = {
  info: (msg: string) => console.log(chalk.blue('[INFO]'), msg),
  success: (msg: string) => console.log(chalk.green('[SUCCESS]'), msg),
  error: (msg: string) => console.log(chalk.red('[ERROR]'), msg),
};

async function testLMStudio() {
  log.info('Testing LM Studio connection...');
  log.info(`Server URL: ${CONFIG.LM_STUDIO.baseURL}`);
  log.info(`Model: ${CONFIG.LM_STUDIO.model}`);
  
  const lmStudio = new OpenAI({
    baseURL: `${CONFIG.LM_STUDIO.baseURL}/v1`,
    apiKey: CONFIG.LM_STUDIO.apiKey,
  });
  
  try {
    // Test 1: List models
    log.info('Test 1: Fetching available models...');
    const models = await lmStudio.models.list();
    log.success(`Available models: ${models.data.map(m => m.id).join(', ')}`);
    
    // Test 2: Simple completion
    log.info('Test 2: Generating test response...');
    const completion = await lmStudio.chat.completions.create({
      model: CONFIG.LM_STUDIO.model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Keep responses brief.'
        },
        {
          role: 'user',
          content: 'Say hello and tell me you\'re working correctly in 10 words or less.'
        }
      ],
      temperature: 0.7,
      max_tokens: 50,
    });
    
    const response = completion.choices[0]?.message?.content;
    log.success(`Response: "${response}"`);
    
    // Test 3: Test with Say What Want context
    log.info('Test 3: Testing with Say What Want context...');
    const swwCompletion = await lmStudio.chat.completions.create({
      model: CONFIG.LM_STUDIO.model,
      messages: [
        {
          role: 'system',
          content: `You are a user of the Say What Want chat app. Your username is TestBot and your color is 076194040. Respond as a casual chat user would. Keep it under 200 characters.`
        },
        {
          role: 'user',
          content: 'The conversation: User1: "Anyone here?" User2: "Yeah what\'s up". Now respond naturally.'
        }
      ],
      temperature: 0.7,
      max_tokens: 100,
    });
    
    const swwResponse = swwCompletion.choices[0]?.message?.content;
    log.success(`Chat response: "${swwResponse}"`);
    
    // Display token usage if available
    if (swwCompletion.usage) {
      log.info(`Tokens used: ${swwCompletion.usage.total_tokens} (prompt: ${swwCompletion.usage.prompt_tokens}, completion: ${swwCompletion.usage.completion_tokens})`);
    }
    
    log.success(chalk.bold.green('\n✅ All tests passed! LM Studio is working correctly.\n'));
    
    // Display configuration summary
    console.log(chalk.cyan('Current Configuration:'));
    console.log('├─ LM Studio URL:', CONFIG.LM_STUDIO.baseURL);
    console.log('├─ Model:', CONFIG.LM_STUDIO.model);
    console.log('├─ Say What Want API:', CONFIG.SWW_API.baseURL);
    console.log('├─ Polling Interval: (now in config-aientities.json botSettings)');
    console.log('├─ Min Time Between Messages:', CONFIG.BOT.minTimeBetweenMessages, 'ms');
    console.log('└─ Dry Run Mode:', CONFIG.DEV.dryRun);
    
  } catch (error) {
    log.error(`Test failed: ${error}`);
    
    if ((error as any).code === 'ECONNREFUSED') {
      log.error('Connection refused. Please check:');
      log.error('1. LM Studio is running');
      log.error('2. Server is enabled in LM Studio settings');
      log.error('3. The URL is correct: ' + CONFIG.LM_STUDIO.baseURL);
    }
    
    process.exit(1);
  }
}

// Run the test
testLMStudio();
