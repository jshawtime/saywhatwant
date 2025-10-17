const fs = require('fs');

// Read config
const config = JSON.parse(fs.readFileSync('./ai/config-aientities.json', 'utf8'));

// Template values
const template = {
  systemRole: "system",
  systemPrompt: "You are a wise and thoughtful being who has deep insights about life and existence. You speak naturally and authentically, like a wise mentor who truly cares. You MUST answer the human's questions or conversation they are instigating directly. Be sensitive to this above all else. If you don't address their thoughts if seems rude. Never deflect or avoid their questions. Be conversational but always respond to what they actually asked.\\n\\n",
  userPrompt: "Continue this conversation from the last thing said by the human in a way that the human user would expect for a truly fascinating and interesting conversation.\\n\\n",
  trimAfter: ["Human:", "\\n"],
  trimWhitespace: true,
  addNewlineToContext: true,
  addEntityUsername: true,
  nom: 100,
  defaultPriority: 50,
  temperature: 0.7,
  maxTokens: 100,
  topP: 0.8,
  topK: 40,
  repeatPenalty: 1.15,
  minP: 0.5,
  responseChance: 0.2,
  rateLimits: {
    minSecondsBetweenPosts: 5,
    maxPostsPerMinute: 10,
    maxPostsPerHour: 300
  }
};

// Update all entities
config.entities = config.entities.map(entity => {
  const color = entity.color; // Preserve existing color
  
  return {
    id: entity.id,
    username: entity.username,
    baseModel: entity.baseModel,
    quantizations: entity.quantizations,
    defaultQuantization: "f16",
    
    systemRole: template.systemRole,
    systemPrompt: template.systemPrompt,
    userPrompt: template.userPrompt,
    
    filterOut: [`${entity.username}:`, "Assitant:"],
    trimAfter: template.trimAfter,
    trimWhitespace: template.trimWhitespace,
    addNewlineToContext: template.addNewlineToContext,
    addEntityUsername: template.addEntityUsername,
    
    nom: template.nom,
    defaultPriority: template.defaultPriority,
    temperature: template.temperature,
    maxTokens: template.maxTokens,
    topP: template.topP,
    topK: template.topK,
    repeatPenalty: template.repeatPenalty,
    minP: template.minP,
    responseChance: template.responseChance,
    color: color, // Keep existing color!
    rateLimits: template.rateLimits,
    enabled: true
  };
});

// Write back with proper formatting
fs.writeFileSync('./ai/config-aientities.json', JSON.stringify(config, null, 2));
console.log(`✅ Updated ${config.entities.length} entities with template`);
