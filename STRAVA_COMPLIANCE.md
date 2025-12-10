# Strava API Compliance Documentation

**Last Updated:** December 10, 2025

## Executive Summary

This document demonstrates our full compliance with Strava's API Terms of Service, specifically regarding the prohibition of using Strava data for training or improving artificial intelligence or machine learning models. Our application uses AI exclusively for inference purposes, processing user data in real-time to provide personalized coaching insights without any form of model training, fine-tuning, or data retention for AI improvement.

## Compliance Statement

**We DO NOT:**
- Train AI/ML models using Strava data
- Fine-tune existing models with Strava data
- Create embeddings or vector databases for machine learning purposes
- Store Strava data for future AI model improvements
- Share Strava data with third parties for AI training
- Use Strava data to improve AI models in any capacity

**We DO:**
- Use Strava data exclusively as runtime context for inference with pre-trained models
- Process Strava data in real-time to generate personalized responses
- Provide AI-powered coaching based on current user data
- Delete Strava data from AI request context immediately after processing

## Technical Architecture

### Data Flow

1. **User Request:** User interacts with the application (chat, training plan generation)
2. **Data Retrieval:** Application fetches user's Strava data via Strava API
3. **Context Assembly:** Strava data is formatted as text context for the AI request
4. **Inference Request:** Data is sent to OpenAI API as part of the prompt (user message)
5. **Response Generation:** OpenAI generates a response using its pre-trained model
6. **Result Delivery:** Response is returned to user and displayed
7. **Data Disposal:** Strava data context is discarded after request completion

### OpenAI Integration

We use OpenAI's API exclusively for inference purposes. According to OpenAI's data usage policy:

**OpenAI API Data Policy (as of December 2025):**
- API requests are NOT used to train or improve OpenAI's models
- Data sent via API is processed for inference only
- API data is retained for 30 days for abuse monitoring, then deleted
- Customers can opt out of data retention entirely via Zero Data Retention policy

**Our Implementation:**
- All Strava data is sent as part of the user message in API requests
- No Strava data is stored in OpenAI's systems beyond standard API retention
- We do not use fine-tuning, embeddings, or any training endpoints
- All usage is inference-only via the Chat Completions API

### Code Implementation

Our OpenAI edge functions (`openai-chat`, `openai-training-plan`, `openai-extract-context`, `openai-modify-plan`) follow this pattern:

```typescript
// 1. Fetch Strava data
const stravaData = await fetchStravaActivities(userId);

// 2. Format as text context
const contextMessage = `User's recent activities: ${formatActivities(stravaData)}`;

// 3. Send to OpenAI for inference only
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: contextMessage }
  ]
});

// 4. Return response and discard context
return response;
```

## Prohibited Operations

To maintain compliance, the following operations are STRICTLY PROHIBITED:

### ❌ Training & Fine-Tuning
```typescript
// NEVER DO THIS
await openai.fineTuning.jobs.create({
  training_file: stravaDataFile,
  model: "gpt-4"
});
```

### ❌ Embeddings for Model Training
```typescript
// NEVER DO THIS
const embedding = await openai.embeddings.create({
  model: "text-embedding-ada-002",
  input: stravaActivityData
});
// If storing embeddings for ML purposes
```

### ❌ Data Collection for Future Training
```typescript
// NEVER DO THIS
await storeForFutureTraining(stravaData);
await collectTrainingDataset(stravaActivities);
```

### ❌ Model Improvement Feedback Loops
```typescript
// NEVER DO THIS
await improveModelWithUserData(stravaData, userFeedback);
```

## Allowed Operations

### ✅ Inference with Runtime Context
```typescript
// This is COMPLIANT
const messages = [
  { role: "system", content: "You are a running coach" },
  { role: "user", content: `Based on my recent runs: ${stravaData}, suggest a workout` }
];
const response = await openai.chat.completions.create({ model: "gpt-4", messages });
```

### ✅ Real-Time Analysis
```typescript
// This is COMPLIANT
const analysis = await analyzePerformance(stravaActivities);
const suggestion = await generateCoachingTip(analysis);
```

## Data Storage Practices

### Strava Data Caching

We cache certain Strava data in our database (`strava_data_cache` table) to:
- Reduce API calls to Strava
- Improve application performance
- Provide faster user experience

**Important:** This caching is for application functionality only and is NOT used for:
- AI model training
- Machine learning dataset creation
- Model improvement or fine-tuning
- Any form of AI/ML development

The cached data is used exclusively for:
- Displaying user statistics in the dashboard
- Providing context for real-time AI inference requests
- Generating training plans based on current fitness level

### Data Retention

- **Strava Activity Data:** Cached for performance, refreshed periodically
- **User Profiles:** Stored for authentication and preferences
- **Chat History:** Stored for conversation continuity
- **Training Plans:** Stored for user reference

**None of this data is used for AI model training or improvement.**

## Third-Party AI Services

### OpenAI

- **Service:** GPT-4 and GPT-3.5-turbo via Chat Completions API
- **Usage:** Inference only
- **Data Policy:** API data not used for training (per OpenAI policy)
- **Retention:** 30-day abuse monitoring (standard OpenAI API policy)
- **Compliance:** Full compliance with OpenAI's terms of service

## Developer Guidelines

### For Current and Future Developers

When working with Strava data and AI features:

1. **Always use inference-only APIs**
   - Chat Completions API ✅
   - Completions API ✅
   - Fine-tuning API ❌
   - Training endpoints ❌

2. **Never store Strava data for ML purposes**
   - Application functionality ✅
   - User experience ✅
   - Model training ❌
   - Dataset creation ❌

3. **Keep Strava data as runtime context**
   - Include in prompt/message ✅
   - Use for real-time analysis ✅
   - Store for training ❌
   - Use for model improvement ❌

4. **Document AI usage clearly**
   - Explain inference purpose ✅
   - Note data disposal ✅
   - Clarify no training ✅

## Audit Trail

### Code Locations

All AI integration code can be audited in:

- `/supabase/functions/openai-chat/index.ts` - Chat functionality
- `/supabase/functions/openai-training-plan/index.ts` - Training plan generation
- `/supabase/functions/openai-extract-context/index.ts` - Context extraction
- `/supabase/functions/openai-modify-plan/index.ts` - Plan modifications
- `/src/services/openaiApi.ts` - OpenAI client wrapper
- `/src/services/stravaApi.ts` - Strava data fetching

Each file contains inline compliance comments marking inference-only usage.

## Policy Review Schedule

This compliance document should be reviewed:
- **Quarterly:** Check for updates to Strava API terms
- **Quarterly:** Verify OpenAI data usage policy hasn't changed
- **After any AI feature addition:** Ensure new features remain compliant
- **Annually:** Full compliance audit of all AI integrations

## Contact & Questions

For questions about our Strava API compliance or AI usage practices:
- Review this document and inline code comments
- Check `/PRIVACY.md` for user-facing privacy information
- Contact development team for technical clarification

## Attestation

As of December 10, 2025, this application is fully compliant with Strava's API Terms of Service section 2.6 regarding AI/ML usage. All AI functionality uses Strava data exclusively for real-time inference with pre-trained models, with no training, fine-tuning, or model improvement of any kind.

---

**Version History:**
- v1.0 (December 10, 2025) - Initial compliance documentation created
