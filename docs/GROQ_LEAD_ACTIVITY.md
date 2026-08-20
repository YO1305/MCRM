# BAHMAL CRM — Groq Lead Activity Detection

## Overview

Replace the old manual "Лид KPI" checkbox system with an intelligent
Groq-based activity analyzer. Groq reads each client's monthly history
and determines whether the lead is **active** or **passive** based on
the quality and context of interactions — not just counting records.

**Remove completely:**
- The "Лид KPI" checkbox/toggle on client cards
- Any stage-based KPI fixation logic
- Manual KPI lead marking from any UI

**Replace with:**
- Groq daily analysis of each client's history
- Automatic active/passive status per client per month
- Configurable activity day threshold (default: 10 days/month)

---

## 1. Remove old KPI lead logic

### Delete or disable these:

- Any field named `kpiLeadCounted`, `kpiLeadMonth`, `kpiLeadFixed` from
  `src/types/client.types.ts`
- The "Лид KPI" toggle/checkbox from `ClientDetail.tsx`
- The "Лид KPI" badge from `ClientCard.tsx`
- The collection `kpi_lead_log` — stop writing to it
  (keep existing data, just stop new writes)
- Any UI that shows "Учёт Лид KPI включён/выключён"
- Stage-based KPI trigger in `setStage()` function

### Keep:
- All other client fields
- All history records
- All stage logic (stages themselves are not affected)

---

## 2. New data model additions

### Add to Client document

```typescript
// src/types/client.types.ts — add these fields

// Activity analysis (set by Groq daily)
activityScore: number | null        // 0-100, set by Groq
activityLabel: 'active' | 'passive' | 'paused' | null
activityMonth: string | null        // "2026-09" — which month this score is for
activityAnalyzedAt: Timestamp | null
activityReason: string | null       // short explanation from Groq why active/passive
activeDaysThisMonth: number | null  // count of distinct days with any activity
```

### New collection: `ai_activity_config`

Single document ID: `settings`

```typescript
interface AiActivityConfig {
  // Threshold: minimum active days per month to be considered active
  minActiveDays: number           // default: 10
                                  // admin can change this in UI

  // Groq prompt for activity analysis (editable by admin)
  activityPrompt: string          // full prompt template

  // Master switch
  isActive: boolean

  // Last updated
  updatedAt: Timestamp
  updatedBy: string
}
```

### Firestore rules

```javascript
match /ai_activity_config/{docId} {
  allow read: if request.auth != null;
  allow write: if isAdmin();
}
```

---

## 3. What counts as an "active day"

A day is counted as active if there is at least one `client_history`
entry for that client on that calendar day with type:

**Full weight (counts as active day):**
- `note` — lead manager comment
- `call` — call log
- `sales_note` — sales manager comment
- `stage_change` — stage moved forward
- `wait_status` — wait status changed (e.g. "Ждём выкрас")
- `next_step` — next step updated with future date

**Partial / low weight (counts as active day only if no pause status):**
- Sample preparation noted (образцы подготовлены)
- Any note mentioning delivery or shipping

**Does NOT count as active day:**
- Status set to "На паузе" and no other action that day
- Automated system entries
- Duplicate entries on same day (only count the day once)

---

## 4. Groq activity analysis

### When it runs

Cloud Function: every day at 08:00 Tashkent time
Same schedule as daily AI task generation — can run in the same function.

### What Groq receives per client

```typescript
interface ActivityAnalysisInput {
  clientId: string
  clientName: string
  stage: string
  currentMonth: string              // "2026-09"
  activeDaysCount: number           // pre-calculated distinct days with activity
  minActiveDaysRequired: number     // from ai_activity_config (default 10)

  // All history entries from current month, formatted as text
  monthHistory: {
    date: string                    // "2026-09-05"
    type: string
    authorName: string
    text: string
  }[]

  // Current wait status
  waitStatus: string | null

  // Days since last touch
  daysSinceLastTouch: number
}
```

### Groq prompt template (stored in `ai_activity_config`)

```
Ты аналитик CRM системы текстильной компании BAHMAL HOME (Узбекистан).

Проанализируй активность по клиенту за текущий месяц и определи:
активный лид или пассивный.

ДАННЫЕ КЛИЕНТА:
- Имя: {clientName}
- Этап воронки: {stage}
- Статус ожидания: {waitStatus}
- Дней с активностью в этом месяце: {activeDaysCount} (минимум нужно: {minActiveDaysRequired})
- Дней без контакта: {daysSinceLastTouch}

ИСТОРИЯ ЗА ТЕКУЩИЙ МЕСЯЦ:
{monthHistory}

ПРАВИЛА ОЦЕНКИ:

Активный лид (active) — если:
- Идут реальные переговоры: обсуждение цены, объёма, условий, прайса, образцов
- Клиент отвечает и задаёт вопросы по существу
- Менеджер и клиент обмениваются конкретной информацией
- Есть движение вперёд даже если медленное

Пассивный лид (passive) — если:
- Менеджер пишет но клиент не отвечает или отвечает формально
- Нет конкретных обсуждений цены, объёма, условий
- Записи формальные ("напомнил", "написал" без результата)

На паузе (paused) — если:
- Явно стоит статус "На паузе" или "Ждём решения" долго без ответа
- Клиент попросил подождать
- Нет активности больше 14 дней подряд

ВАЖНО:
- Смотри на СОДЕРЖАНИЕ записей, не только на их количество
- Подготовка образцов без подтверждения от клиента = малый вес
- Статус "На паузе" без других активных действий = пассивный/паузе
- Если записей мало но они содержательные = может быть активный

Ответь строго в формате JSON:
{
  "label": "active" | "passive" | "paused",
  "score": 0-100,
  "reason": "краткое объяснение на русском (1 предложение)"
}
```

### Groq API call

```typescript
// functions/src/leadActivityAnalyzer.ts

async function analyzeClientActivity(
  input: ActivityAnalysisInput,
  config: AiActivityConfig
): Promise<{ label: string; score: number; reason: string }> {

  const prompt = buildActivityPrompt(config.activityPrompt, input)

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
      temperature: 0.2,          // low temperature for consistent classification
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content?.trim()
    const result = JSON.parse(raw || '{}')

    return {
      label: result.label || 'passive',
      score: result.score || 0,
      reason: result.reason || '',
    }

  } catch (error) {
    console.error('Groq activity analysis error:', error)
    // Fallback: use day count only
    const label = input.activeDaysCount >= input.minActiveDaysRequired
      ? 'active' : 'passive'
    return { label, score: 0, reason: 'Авто-оценка по количеству дней' }
  }
}
```

---

## 5. Pre-calculate active days before sending to Groq

Before calling Groq, calculate `activeDaysCount` from Firestore.
This saves tokens and gives Groq a concrete number to work with.

```typescript
async function calculateActiveDays(
  clientId: string,
  month: string           // "2026-09"
): Promise<number> {

  const startDate = new Date(month + '-01')
  const endDate = new Date(startDate.getFullYear(),
                           startDate.getMonth() + 1, 0) // last day of month

  const historySnap = await admin.firestore()
    .collection('client_history')
    .where('clientId', '==', clientId)
    .where('createdAt', '>=', startDate)
    .where('createdAt', '<=', endDate)
    .get()

  // Count distinct calendar days
  const days = new Set<string>()

  for (const doc of historySnap.docs) {
    const data = doc.data()

    // Skip types that don't count
    const skipTypes = ['system', 'auto']
    if (skipTypes.includes(data.type)) continue

    // Skip if only action that day was setting pause status
    const dateStr = formatDate(data.createdAt.toDate())
    days.add(dateStr)
  }

  return days.size
}
```

---

## 6. Main Cloud Function

```typescript
// functions/src/leadActivityAnalyzer.ts

export const dailyLeadActivityAnalysis = functions.pubsub
  .schedule('0 3 * * *')         // 08:00 Tashkent = 03:00 UTC
  .timeZone('Asia/Tashkent')
  .onRun(async () => {

    // Read config
    const configDoc = await admin.firestore()
      .doc('ai_activity_config/settings')
      .get()

    const config: AiActivityConfig = {
      minActiveDays: 10,
      activityPrompt: DEFAULT_ACTIVITY_PROMPT,
      isActive: true,
      ...configDoc.data(),
    }

    if (!config.isActive) {
      console.log('Activity analysis disabled')
      return
    }

    const currentMonth = getCurrentMonth() // "2026-09"

    // Get all non-final clients
    const clientsSnap = await admin.firestore()
      .collection('clients')
      .where('stage', 'not-in', ['deal', 'rejected', 'failed', 'abandoned'])
      .get()

    for (const doc of clientsSnap.docs) {
      const client = doc.data() as Client

      try {
        // Get history for current month
        const startDate = new Date(currentMonth + '-01')
        const endDate = new Date(
          startDate.getFullYear(),
          startDate.getMonth() + 1, 0
        )

        const historySnap = await admin.firestore()
          .collection('client_history')
          .where('clientId', '==', client.id)
          .where('createdAt', '>=', startDate)
          .where('createdAt', '<=', endDate)
          .orderBy('createdAt', 'asc')
          .get()

        const history = historySnap.docs.map(d => ({
          date: formatDate(d.data().createdAt.toDate()),
          type: d.data().type,
          authorName: d.data().authorName || '',
          text: d.data().text || '',
        }))

        // Calculate active days
        const activeDaysCount = await calculateActiveDays(
          client.id, currentMonth
        )

        // Build input for Groq
        const input: ActivityAnalysisInput = {
          clientId: client.id,
          clientName: client.name,
          stage: STAGE_LABELS_RU[client.stage] || client.stage,
          currentMonth,
          activeDaysCount,
          minActiveDaysRequired: config.minActiveDays,
          monthHistory: history,
          waitStatus: client.waitStatus || null,
          daysSinceLastTouch: daysDiff(client.lastTouchDate, new Date()),
        }

        // Call Groq
        const result = await analyzeClientActivity(input, config)

        // Save result to client document
        await doc.ref.update({
          activityScore: result.score,
          activityLabel: result.label,
          activityMonth: currentMonth,
          activityAnalyzedAt: admin.firestore.FieldValue.serverTimestamp(),
          activityReason: result.reason,
          activeDaysThisMonth: activeDaysCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 300))

      } catch (error) {
        console.error(`Activity analysis error for ${client.id}:`, error)
      }
    }

    console.log('Daily activity analysis complete')
  })
```

---

## 7. Admin UI — Activity Settings

### Location

`Settings → ИИ Помощник → Активность лидов` (new tab inside AI settings)

Or add as second tab in existing `AiSettings.tsx`.

### UI elements

```
НАСТРОЙКИ АКТИВНОСТИ ЛИДОВ
──────────────────────────────────────────
Минимум дней активности в месяц: [10]
  ↳ Лид считается активным если в этом месяце
    было минимум X дней с реальными действиями

Анализ активности (Groq): [Включён ●]

ПРОМПТ ДЛЯ АНАЛИЗА АКТИВНОСТИ:
┌─────────────────────────────────────────┐
│ Ты аналитик CRM системы...              │
│ [редактируемое текстовое поле]          │
└─────────────────────────────────────────┘

ТЕСТ:
Выбери клиента: [ поиск... ▾ ]
[Запустить тест]

Результат:
┌─────────────────────────────────────────┐
│ Статус: Активный                        │
│ Оценка: 78/100                          │
│ Причина: Идут обсуждения прайса и       │
│ объёма, клиент отвечает по существу     │
│ Дней активности: 8 из 10 нужных        │
└─────────────────────────────────────────┘

[Сохранить настройки]
```

### Hook: useAiActivityConfig

```typescript
// src/hooks/useAiActivityConfig.ts

function useAiActivityConfig(): {
  config: AiActivityConfig | null
  loading: boolean
  saveConfig: (data: Partial<AiActivityConfig>) => Promise<void>
}
```

---

## 8. UI — what admin sees on client cards

### Activity badge on card (admin only)

```tsx
// Show only if activityLabel is set and activityMonth === currentMonth

{isAdmin() && client.activityLabel && (
  <ActivityBadge
    label={client.activityLabel}
    score={client.activityScore}
    days={client.activeDaysThisMonth}
    minDays={config?.minActiveDays ?? 10}
    reason={client.activityReason}
  />
)}
```

Badge styles:
- `active` → green "Активный · 12 дн."
- `passive` → amber "Пассивный · 4 дн."
- `paused` → gray "На паузе · 0 дн."

Tooltip on hover shows `activityReason`.

### Filter chips in CRM (admin only)

```
[Все] [Активные] [Пассивные] [На паузе]
```

Filter by `activityLabel` field.

### Dashboard widget (admin only)

```
Активность лидов — Сентябрь 2026
─────────────────────────────────
Активные:    12  ██████████░░░░  
Пассивные:    8  ████████░░░░░░  
На паузе:    10  █████████░░░░░  
Не оценены:   2  ██░░░░░░░░░░░░  
```

---

## 9. Active days counter on client card

Show to manager (not just admin) so they know where they stand:

```
Активность в сентябре: 7 из 10 дней  🟡
```

Color:
- Green ≥ minActiveDays
- Amber: minActiveDays - 3 to minActiveDays - 1
- Red: < minActiveDays - 3

This motivates managers to keep working with clients without
exposing the full admin-only analysis.

---

## 10. Files to create / modify — summary

| Action | File |
|---|---|
| **Create** | `functions/src/leadActivityAnalyzer.ts` |
| **Create** | `src/hooks/useAiActivityConfig.ts` |
| **Create** | `src/types/aiActivity.types.ts` |
| **Modify** | `functions/src/index.ts` — export dailyLeadActivityAnalysis |
| **Modify** | `src/types/client.types.ts` — add activity fields, REMOVE kpiLead fields |
| **Modify** | `src/pages/settings/AiSettings.tsx` — add activity config tab |
| **Modify** | `src/components/crm/ClientCard.tsx` — add activity badge (admin), active days counter (all) |
| **Modify** | `src/components/crm/ClientDetail.tsx` — REMOVE "Лид KPI" toggle, add active days counter |
| **Modify** | `src/pages/CRM.tsx` — add activity filter chips (admin) |
| **Modify** | `src/pages/Dashboard.tsx` — add activity widget (admin) |
| **Modify** | `src/hooks/useClients.ts` — remove kpiLead logic from setStage |
| **Modify** | `firestore.rules` — add rules for ai_activity_config |

---

## 11. Migration for existing clients

On first deploy, all clients will have `activityLabel: null`.
The Cloud Function will populate them starting the next morning.

For immediate population (optional):
Add a one-time admin button "Запустить анализ сейчас" that triggers
the analysis for all clients immediately via a Firebase callable function.

```typescript
// functions/src/index.ts
export const runActivityAnalysisNow = functions.https.onCall(
  async (data, context) => {
    // Check admin
    if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '')
    // Run same logic as scheduled function
    await runActivityAnalysis()
  }
)
```

---

## 12. What is NOT in scope

- Do not use activityLabel for KPI calculation yet — KPI is next module
- Do not show activityScore or activityReason to managers — admin only
- Do not block managers from working with passive/paused leads
- Do not auto-archive passive leads
- Do not send notifications based on activityLabel — notifications stay in leadActivity module
- Do not change how stages work — stages are independent from activity
