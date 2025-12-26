# Apple Health Sync API Documentation

## Overview

The `sync-health` Edge Function allows you to sync Apple Health data (sleep, resting heart rate, HRV) from your iPhone to TrainingSmart AI using an iOS Shortcut.

---

## Endpoint

**URL:** `https://[YOUR_SUPABASE_URL]/functions/v1/sync-health`

**Method:** `POST`

**Authentication:** Bearer token (Supabase Auth JWT)

---

## Request Format

### Headers

```
Authorization: Bearer YOUR_SUPABASE_JWT_TOKEN
Content-Type: application/json
```

### Request Body

```json
{
  "sleep_minutes": 450,
  "resting_hr": 58,
  "hrv": 45,
  "date": "2023-10-27"
}
```

### Field Descriptions

| Field | Type | Required | Description | Validation |
|-------|------|----------|-------------|------------|
| `sleep_minutes` | Number | Yes | Total sleep in minutes | Must be >= 0 |
| `resting_hr` | Number | Yes | Resting Heart Rate (bpm) | Must be between 30 and 200 |
| `hrv` | Number | Yes | Heart Rate Variability (ms) | Must be between 0 and 300 |
| `date` | String | No | ISO Date (YYYY-MM-DD) | Defaults to today if not provided |

---

## Response Format

### Success Response (200)

```json
{
  "success": true,
  "message": "Health metrics synced successfully",
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "date": "2023-10-27",
    "sleep_minutes": 450,
    "resting_hr": 58,
    "hrv": 45,
    "recovery_score": 92,
    "created_at": "2023-10-27T08:00:00Z",
    "updated_at": "2023-10-27T08:00:00Z"
  }
}
```

### Error Responses

**401 Unauthorized** - Missing or invalid authorization token
```json
{
  "error": "Missing Authorization header"
}
```

**400 Bad Request** - Invalid payload
```json
{
  "error": "Invalid payload. Required fields: sleep_minutes (number), resting_hr (number), hrv (number)"
}
```

**405 Method Not Allowed** - Wrong HTTP method
```json
{
  "error": "Method not allowed. Use POST."
}
```

**500 Internal Server Error** - Server error
```json
{
  "error": "Failed to save metrics",
  "details": "error details"
}
```

---

## Recovery Score Calculation

The endpoint automatically calculates a `recovery_score` (0-100) using this algorithm:

### Sleep Score (50 points max)
- If `sleep_minutes >= 420` (7 hours): **50 points**
- If `sleep_minutes < 420`: Scaled proportionally `(sleep_minutes / 420) * 50`

### HRV Score (50 points max)
- If `hrv >= 50`: **50 points**
- If `hrv < 50`: Scaled proportionally `(hrv / 50) * 50`

### Total Score
```
recovery_score = sleep_score + hrv_score
```

**Examples:**
- 8 hours sleep (480 min) + 60ms HRV = 50 + 50 = **100 points**
- 6 hours sleep (360 min) + 40ms HRV = 43 + 40 = **83 points**
- 5 hours sleep (300 min) + 30ms HRV = 36 + 30 = **66 points**

---

## Database Behavior

### Upsert Logic
The endpoint uses **upsert** (insert or update) logic:

- **First sync of the day:** Creates a new record
- **Subsequent syncs:** Updates the existing record for that date

This prevents duplicate entries and allows you to resync data if needed.

### Unique Constraint
Only one record per `(user_id, date)` combination is allowed.

---

## iOS Shortcut Setup

### Step 1: Get Your Auth Token

You need your Supabase JWT token. You can get this from your browser:

1. Log into TrainingSmart AI
2. Open browser DevTools (F12)
3. Go to Application > Local Storage
4. Find the `supabase.auth.token` value
5. Copy the `access_token` value

**Important:** Tokens expire. You'll need to refresh them periodically (typically every hour).

### Step 2: Create the iOS Shortcut

1. Open **Shortcuts** app on iPhone
2. Create new shortcut
3. Add these actions:

#### Get Sleep Data
- **Get Health Sample**
  - Type: Sleep Analysis
  - Period: Today
- **Calculate Statistics**
  - Input: Health Samples
  - Statistic: Sum
  - Unit: Minutes

#### Get Resting Heart Rate
- **Get Health Sample**
  - Type: Resting Heart Rate
  - Period: Today
  - Limit: 1 (most recent)

#### Get HRV
- **Get Health Sample**
  - Type: Heart Rate Variability
  - Period: Today
  - Limit: 1 (most recent)

#### Build JSON
- **Dictionary** action
  - `sleep_minutes`: [Sleep result in minutes]
  - `resting_hr`: [Resting HR value]
  - `hrv`: [HRV value]

#### Send to API
- **Get Contents of URL**
  - URL: `https://[YOUR_SUPABASE_URL]/functions/v1/sync-health`
  - Method: POST
  - Headers:
    - `Authorization`: `Bearer [YOUR_TOKEN]`
    - `Content-Type`: `application/json`
  - Request Body: JSON (from Dictionary)

#### Show Result
- **Show Notification**
  - Title: "Health Sync Complete"
  - Body: [Response from API]

### Step 3: Automate

Set up automation to run this shortcut daily:

1. Open **Shortcuts** app
2. Go to **Automation** tab
3. Create **Personal Automation**
4. Trigger: **Time of Day** (e.g., 8:00 AM)
5. Action: Run your sync shortcut

---

## Testing the Endpoint

### Using curl

```bash
curl -X POST https://[YOUR_SUPABASE_URL]/functions/v1/sync-health \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sleep_minutes": 450,
    "resting_hr": 58,
    "hrv": 45,
    "date": "2023-10-27"
  }'
```

### Using Postman

1. Set method to **POST**
2. Enter URL: `https://[YOUR_SUPABASE_URL]/functions/v1/sync-health`
3. Add headers:
   - `Authorization`: `Bearer YOUR_TOKEN`
   - `Content-Type`: `application/json`
4. Body (raw JSON):
```json
{
  "sleep_minutes": 450,
  "resting_hr": 58,
  "hrv": 45
}
```

---

## Database Structure

### Table: `daily_metrics`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Foreign key to auth.users |
| `date` | Date | The day these metrics are for |
| `sleep_minutes` | Integer | Total sleep in minutes |
| `resting_hr` | Integer | Resting heart rate (bpm) |
| `hrv` | Integer | Heart rate variability (ms) |
| `recovery_score` | Integer | Calculated score (0-100) |
| `created_at` | Timestamptz | When record was created |
| `updated_at` | Timestamptz | When record was last updated |

### Security (Row Level Security)

RLS policies ensure:
- Users can only read their own metrics
- Users can only insert/update their own metrics
- Authentication is required for all operations

---

## Common Issues

### "Missing Authorization header"
- Ensure you're sending the `Authorization: Bearer TOKEN` header
- Check that your token hasn't expired

### "Invalid payload"
- Verify all required fields are present: `sleep_minutes`, `resting_hr`, `hrv`
- Ensure values are numbers, not strings

### "resting_hr must be between 30 and 200"
- Apple Health might return invalid values
- Add validation in your iOS Shortcut before sending

### "Unauthorized"
- Your JWT token has expired
- Get a fresh token from your browser

---

## Future Enhancements

Potential improvements for this endpoint:

1. **Token Refresh:** Automatic token refresh in iOS Shortcut
2. **Batch Upload:** Send multiple days at once
3. **Additional Metrics:** Active calories, steps, exercise minutes
4. **Trend Analysis:** Historical recovery score trends
5. **Push Notifications:** Alert when recovery is low
6. **Integration with Training Plans:** Adjust workouts based on recovery

---

## Support

If you encounter issues:

1. Check the Edge Function logs in Supabase dashboard
2. Verify your payload matches the expected format
3. Ensure your JWT token is valid and not expired
4. Test with curl first before building the iOS Shortcut

---

**Last Updated:** December 26, 2025
