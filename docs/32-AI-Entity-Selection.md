# Smart AI Entity Selection System

## 📌 Overview

This document outlines the proposed smart entity selection system for Phase 2 of the AI Bot refactor. The goal is to move beyond random selection to a context-aware, intelligent system that chooses the most appropriate entity for each situation.

## 🎯 Core Principles

The entity selection should feel **natural and conversational**, not random. Each entity should have:

1. **Expertise areas** they're best suited for
2. **Conversation patterns** they recognize
3. **Direct address detection** when mentioned by name
4. **Context memory** of recent interactions

## 📊 Entity Selection Algorithm

The selection algorithm uses a **scoring system** that evaluates each entity based on multiple factors:

### Scoring Components

```typescript
class SmartEntitySelector {
  
  selectBestEntity(context: ConversationContext): Entity {
    const scores = new Map<Entity, number>();
    
    for (const entity of enabledEntities) {
      let score = 0;
      
      // 1. DIRECT ADDRESS (Highest Priority) - 100 points
      // "Hey DeepThought, what do you think?"
      if (context.lastMessage.includes(entity.username)) {
        score += 100;  // Immediate selection
      }
      
      // 2. TOPIC EXPERTISE MATCH - 0-30 points
      // Entity has defined interests/expertise
      const topicMatch = this.calculateTopicMatch(
        context.extractedTopics,
        entity.interests
      );
      score += topicMatch * 30;
      
      // 3. CONVERSATION PATTERN MATCH - 0-20 points
      // "?" → philosophical entities
      // "how to" → technical entities
      // emotions → empathetic entities
      const patternMatch = this.matchConversationPattern(
        context.messagePatterns,
        entity.responsePatterns
      );
      score += patternMatch * 20;
      
      // 4. CONVERSATION CONTINUITY - 15 points
      // If entity was recently active and conversation ongoing
      if (entity.lastResponseTime) {
        const timeSince = Date.now() - entity.lastResponseTime;
        if (timeSince < 60000 && context.isOngoingConversation) {
          score += 15;  // Stay in conversation
        }
      }
      
      // 5. DIVERSITY PENALTY - negative points
      // Avoid same entity responding too often
      const recentResponses = entity.getRecentResponseCount(5);
      score -= recentResponses * 10;  // -10 per recent response
      
      // 6. MOOD/TONE MATCH - 0-10 points
      // Match entity personality to conversation mood
      const moodMatch = this.matchMood(
        context.conversationMood,
        entity.personality.mood
      );
      score += moodMatch * 10;
      
      scores.set(entity, score);
    }
    
    // Return highest scoring entity
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])[0][0];
  }
}
```

### Score Weights Summary

| Factor | Points | Priority |
|--------|--------|----------|
| Direct Address | 100 | Highest |
| Topic Match | 0-30 | High |
| Pattern Match | 0-20 | Medium |
| Conversation Continuity | 15 | Medium |
| Mood Match | 0-10 | Low |
| Diversity Penalty | -10 per recent | Negative |

## 🎨 Enhanced Entity Configuration

Each entity would have enriched configuration beyond the current simple fields:

```json
{
  "id": "philosopher",
  "username": "DeepThought",
  "model": "highermind_the-eternal-1",
  
  // NEW: Expertise & Interests
  "expertise": {
    "topics": ["philosophy", "consciousness", "existence", "meaning"],
    "keywords": ["why", "purpose", "reality", "think", "believe"],
    "questionTypes": ["existential", "moral", "theoretical"]
  },
  
  // NEW: Conversation Patterns
  "conversationPatterns": {
    "triggers": {
      "highProbability": ["What is the meaning", "Do you think", "consciousness"],
      "mediumProbability": ["why", "believe", "soul", "reality"],
      "lowProbability": ["feel", "wonder", "imagine"]
    },
    "avoidPatterns": ["code", "debug", "technical", "API"]
  },
  
  // NEW: Direct Address Recognition
  "addressPatterns": {
    "aliases": ["Deep", "DT", "philosopher"],
    "respondToGeneric": ["anyone", "somebody", "AI", "bot"],
    "ignoreGeneric": false  // If true, only responds when directly named
  },
  
  // NEW: Personality Traits
  "personality": {
    "mood": "contemplative",  // playful, serious, helpful, mysterious
    "engagement": "thoughtful", // reactive, proactive, selective
    "responseLength": "moderate",  // brief, moderate, verbose
    "humor": 0.3,  // 0-1 scale
    "formality": 0.7  // 0-1 scale
  },
  
  // Existing fields remain...
  "systemPrompt": "...",
  "temperature": 0.6,
  "maxTokens": 150,
  "messagesToRead": 50,
  // etc...
}
```

## 🔍 Direct Address Detection

A sophisticated system for detecting when an entity is being directly addressed:

```typescript
class DirectAddressDetector {
  
  isEntityAddressed(message: string, entity: Entity): {
    addressed: boolean;
    confidence: number;
    type: 'direct' | 'alias' | 'generic' | 'none';
  } {
    const lower = message.toLowerCase();
    
    // 1. EXACT USERNAME MATCH
    if (lower.includes(entity.username.toLowerCase())) {
      return { addressed: true, confidence: 1.0, type: 'direct' };
    }
    
    // 2. ALIAS MATCH (nicknames)
    for (const alias of entity.addressPatterns.aliases) {
      if (lower.includes(alias.toLowerCase())) {
        return { addressed: true, confidence: 0.9, type: 'alias' };
      }
    }
    
    // 3. GENERIC AI ADDRESS
    const genericPatterns = ['hey ai', 'hey bot', '@ai', '@bot', 'anyone there'];
    for (const pattern of genericPatterns) {
      if (lower.includes(pattern)) {
        if (!entity.addressPatterns.ignoreGeneric) {
          return { addressed: true, confidence: 0.5, type: 'generic' };
        }
      }
    }
    
    // 4. REPLY CHAIN DETECTION
    // If the last message was from this entity and someone replied
    if (this.lastSpeaker === entity.username && this.isReply(message)) {
      return { addressed: true, confidence: 0.7, type: 'direct' };
    }
    
    return { addressed: false, confidence: 0, type: 'none' };
  }
}
```

## 💡 Enhanced Conversation Context

The conversation context would be enriched with more analytical data:

```typescript
interface EnhancedConversationContext {
  // Existing
  recentMessages: string;
  activeUsers: string[];
  
  // NEW: Topic Extraction
  extractedTopics: {
    primary: string[];     // Main topics discussed
    secondary: string[];   // Related topics
    keywords: string[];    // Important keywords
  };
  
  // NEW: Conversation Dynamics
  conversationMood: 'casual' | 'serious' | 'playful' | 'heated' | 'questioning';
  isOngoingConversation: boolean;
  conversationVelocity: number;  // Messages per minute
  
  // NEW: Message Patterns
  messagePatterns: {
    hasQuestions: boolean;
    hasCode: boolean;
    hasEmotions: boolean;
    hasTechnicalTerms: boolean;
    hasPhilosophical: boolean;
  };
  
  // NEW: User Engagement
  userEngagement: {
    [username: string]: {
      messageCount: number;
      lastMessageTime: number;
      sentiment: 'positive' | 'neutral' | 'negative';
    }
  };
}
```

## 🎬 Example Scenarios

### Scenario 1: Direct Address
```
User: "Hey DeepThought, what's the meaning of life?"
```
- DeepThought scores +100 for direct address
- Selected with 100% confidence
- Other entities don't compete

### Scenario 2: Topic Match
```
User: "I wonder why consciousness exists"
```
- DeepThought (philosopher) scores +25 for topic match
- ByteWise (tech) scores +0 for topic match
- DeepThought selected unless recently active

### Scenario 3: Technical Question
```
User: "How do I fix this API error?"
```
- ByteWise scores +28 for technical pattern match
- DeepThought scores -5 (avoid pattern)
- ByteWise selected

### Scenario 4: Ongoing Conversation
```
DeepThought: "Reality might be a simulation"
User: "That's interesting, tell me more"
```
- DeepThought scores +15 for conversation continuity
- Maintains the conversation thread

### Scenario 5: Generic Address
```
User: "Hey AI, anyone there?"
```
- All entities score +5 for generic address
- Least recently used entity wins (diversity penalty)
- Unless entity has `ignoreGeneric: true`

### Scenario 6: Multiple Factors
```
User: "DeepThought, can you help me debug this consciousness simulation code?"
```
- DeepThought: +100 (direct) -10 (technical avoid) = 90
- ByteWise: +20 (technical pattern) = 20
- DeepThought still wins due to direct address

## 📈 Benefits

### Natural Conversations
- Entities respond when it makes sense contextually
- No more random "wrong entity for the topic" situations

### Expertise Utilization
- Technical questions → Technical entities
- Philosophical questions → Philosophical entities
- Emotional support → Empathetic entities

### User Control
- Users can directly address specific entities
- System respects user preference while maintaining naturalness

### Diversity
- Prevents single entity domination
- Ensures variety in conversations

### Continuity
- Maintains conversation threads
- Entities stay engaged when actively conversing

## 🔄 Implementation Strategy

### Phase 2a: Entity Class System
1. Create `Entity` base class with scoring methods
2. Implement `SmartEntitySelector` class
3. Add topic extraction utilities
4. Build pattern matching system

### Phase 2b: Enhanced Configuration
1. Migrate existing entities to new format
2. Add expertise and pattern definitions
3. Define personality traits for each entity
4. Create alias mappings

### Phase 2c: Context Analysis
1. Enhance `ConversationAnalyzer` with topic extraction
2. Add mood detection algorithms
3. Implement conversation velocity tracking
4. Build user engagement metrics

### Phase 2d: Testing & Tuning
1. Test scoring weights with real conversations
2. Fine-tune point values
3. Add logging for selection reasoning
4. Create selection override mechanism for testing

## 🎯 Success Metrics

- **Selection Accuracy**: Right entity chosen 80%+ of the time
- **Response Relevance**: Entity responses match conversation context
- **User Satisfaction**: Direct addresses always honored
- **Conversation Flow**: Natural, engaging conversations
- **Entity Diversity**: All entities get appropriate usage

## 🔮 Future Enhancements

### Learning System
- Entities learn from successful/unsuccessful interactions
- Scoring weights adjust based on outcomes
- Topic associations strengthen over time

### Memory System
- Entities remember previous conversations with users
- Build user preference profiles
- Maintain conversation history per entity

### Collaborative Responses
- Multiple entities can collaborate on complex topics
- Hand-off system between entities
- Meta-entity that coordinates others

## 📝 Notes

- Current system uses random selection with `responseChance`
- This proposal would replace that with deterministic smart selection
- Backwards compatible with existing entity configs (defaults for new fields)
- Can be implemented incrementally without breaking existing system
