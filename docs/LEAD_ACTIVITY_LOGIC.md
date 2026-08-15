# BAHMAL CRM — Логика активности лидов (как работает сейчас)

Документ описывает **текущую реализацию** в коде (не KPI).  
KPI-оплата — отдельный модуль и сюда не входит.

---

## 1. Зачем это нужно

Система отвечает на вопрос руководителя:

> Лид «живой» или уже «завис» / пора заморозить?

Это **не** означает «менеджер сейчас работает».  
Статус **Активный** — узкий: лид уже не в первом месяце **и** выполнены все 3 критерия работы.

---

## 2. Поля в карточке клиента (`clients`)

| Поле | Формат | Смысл |
|------|--------|--------|
| `openedDate` | `YYYY-MM-DD` | **Реальная** дата начала работы с лидом (календарь в карточке) |
| `openedMonth` | `YYYY-MM` | Месяц из `openedDate` (считается автоматически) |
| `lastTouchDate` | `YYYY-MM-DD` | Последнее «касание» менеджера |
| `lastStageChangeDate` | `YYYY-MM-DD` | Последнее движение по воронке |
| `nextStep` | текст | Следующий шаг |
| `nextStepDeadline` | `YYYY-MM-DD` | Срок следующего шага |
| `activityStatus` | см. ниже | Текущий статус |
| `activeMonthsCount` | число | Сколько месяцев лид в работе (1, 2, 3…) |

### Как берётся дата открытия

Приоритет:

1. `openedDate` (если менеджер/админ проставил в календаре)
2. иначе `openedMonth`
3. иначе дата создания карточки в CRM (`createdAt`)
4. иначе сегодняшний месяц

**Важно:** CRM завели с августа, поэтому у многих `createdAt` = август, хотя лид реально идёт с мая–июля.  
Поэтому менеджер **обязан** проставить реальную дату в поле «Дата открытия лида».

---

## 3. Четыре статуса

```text
new       — Новый
active    — Активный
critical  — Требует внимания
frozen    — Заморожен
```

| Статус | Когда |
|--------|--------|
| **Новый** | 1-й месяц с даты открытия. Критерии **не проверяются**. |
| **Активный** | 2–3-й месяц **и** все 3 критерия ОК |
| **Требует внимания** | 2–3-й месяц **и** провален ровно **1** критерий |
| **Заморожен** | 2–3-й месяц и провалено **2+** критерия **ИЛИ** лид открыт **4+ месяца** без сделки |

Сделка / отказ / архив (`deal`, `rejected`, `failed`, `abandoned`) — статус **не пересчитывается**.

«Пассивного» статуса нет. Ближе всего к «пассиву» — **Заморожен**.

---

## 4. Три критерия (только со 2-го месяца)

| № | Критерий | Провал если |
|---|----------|-------------|
| 1 | Касание | нет `lastTouchDate` **или** прошло **больше 14 дней** |
| 2 | Следующий шаг | нет `nextStepDeadline` **или** дата **в прошлом** |
| 3 | Движение | нет `lastStageChangeDate` **или** прошло **больше 45 дней** |

### Что обновляет касание (`lastTouchDate`)

Записи в истории / действия:

- заметка лида (`note`)
- звонок (`call`)
- комментарий продаж (`sales_note`)
- смена этапа (`stage_change`)
- статус ожидания (`wait_status`)
- следующий шаг (`next_step`)

### Что обновляет движение (`lastStageChangeDate`)

- смена этапа
- статус ожидания
- изменение суммы сделки

---

## 5. Почему сейчас может быть «Активных: 0»

Чтобы стать **Активным**, нужно **одновременно**:

1. Дата открытия **не в текущем месяце** (иначе всегда **Новый**)
2. Касание ≤ 14 дней
3. Есть актуальный `nextStepDeadline`
4. Движение ≤ 45 дней

Типичные причины нуля активных:

- всем стоит август (дата занесения в CRM) → все **Новые**
- у лидов 2–3 месяца нет срока следующего шага → уже не Активный (минимум «Требует внимания»)
- давно не писали/не звонили → касание провалено

---

## 6. Кто что видит

| Роль | Бейджи / фильтры / дашборд | Может ставить дату открытия | Получает уведомления |
|------|----------------------------|------------------------------|----------------------|
| Админ / начальник | да | да | да (часть админских) |
| Менеджер по лидам | нет | да (свои клиенты) | да (личные) |
| Менеджер продаж | нет | нет (только просмотр ядра) | по назначению |

Замороженный лид **не скрывается** из CRM — работать можно дальше.

---

## 7. Уведомления

| Условие | Кому | Тип |
|---------|------|-----|
| Ровно 14 дней без касания | менеджер лида | `lead_no_touch` |
| Ровно 30 дней без касания | админы | `lead_no_touch_admin` |
| Просрок следующего шага | менеджер лида | `lead_next_step_overdue` |
| Стал 3-й месяц | менеджер лида | `lead_month_3` |
| Стал `frozen` | менеджер + админы | `lead_frozen` |

Дубли режутся через `dedupeKey`. Ссылка: `/crm?client=ID`.

---

## 8. Основной код расчёта статуса

Файл: `src/utils/leadActivity.ts`

```typescript
export function calculateActivityStatus(
  client: Client,
  today: Date = new Date(),
): ActivityStatus {
  // Сделка / архив — не трогаем
  if (isLeadFinal(client.stage)) {
    return client.activityStatus || 'active'
  }

  const openedMonth = resolveOpenedMonth(client)
  const activeMonths = calculateActiveMonths(openedMonth)

  // 4+ месяца без сделки → заморожен
  if (activeMonths >= 4) return 'frozen'

  // 1-й месяц → всегда новый (критерии не смотрим)
  if (activeMonths === 1) return 'new'

  // --- только 2–3 месяц ---
  const todayISOStr = todayISO()
  const daysSinceTouch = daysDiff(client.lastTouchDate, today)
  const nextStepOverdue = !client.nextStepDeadline || client.nextStepDeadline < todayISOStr
  const daysSinceMovement = daysDiff(client.lastStageChangeDate, today)

  const failedCount = [
    daysSinceTouch > 14,       // критерий 1
    nextStepOverdue,           // критерий 2
    daysSinceMovement > 45,    // критерий 3
  ].filter(Boolean).length

  if (failedCount === 0) return 'active'      // всё ок
  if (failedCount === 1) return 'critical'    // один сбой
  return 'frozen'                             // два и больше
}
```

### Подсчёт месяцев

Файл: `src/utils/dateUtils.ts`

```typescript
// Сколько целых месяцев между "YYYY-MM" и сегодня (0 = этот месяц)
export function monthDiff(openedMonth: string | null | undefined, today: Date = new Date()): number {
  if (!openedMonth) return 0
  const [year, month] = openedMonth.split('-').map(Number)
  const opened = new Date(year, (month || 1) - 1, 1)
  return (today.getFullYear() - opened.getFullYear()) * 12 + (today.getMonth() - opened.getMonth())
}

// 1-based: этот месяц = 1, прошлый = 2, ...
export function calculateActiveMonths(openedMonthOrDate: string | null | undefined): number {
  if (!openedMonthOrDate) return 1
  const monthKey =
    openedMonthOrDate.length >= 10 ? openedMonthOrDate.slice(0, 7) : openedMonthOrDate
  return Math.min(monthDiff(monthKey, new Date()) + 1, 99)
}
```

**Пример (сегодня август 2026):**

| `openedDate` | Месяц работы | Статус (до критериев) |
|--------------|--------------|------------------------|
| 2026-08-10 | 1 | Новый |
| 2026-07-05 | 2 | смотрим 3 критерия |
| 2026-06-01 | 3 | смотрим 3 критерия |
| 2026-05-01 | 4 | Заморожен сразу |

---

## 9. Как обновляются даты при действиях

Файл: `src/hooks/useClients.ts` + `activityPatch()` в `leadActivity.ts`

При действии вызывается `activityPatch(client, data, { touch?, movement? })`:

- `touch: true` → `lastTouchDate = сегодня` + пересчёт статуса
- `movement: true` → ещё и `lastStageChangeDate = сегодня`
- сохраняются `activityStatus`, `activeMonthsCount`, `openedMonth` / `openedDate`

Раз в день (при входе в CRM) `LeadActivityScanner` пересчитывает статусы и шлёт уведомления.

---

## 10. UI

| Где | Что |
|-----|-----|
| Карточка клиента | Календарь «Дата открытия лида» (менеджер лида / админ) |
| Карточка / канбан | Бейдж статуса — **только** админ/начальник |
| CRM | Фильтры: Все / Новые / Активные / Критические / Замороженные — админ/начальник |
| Дашборд | Счётчики + кнопка «Проставить даты по истории» — админ |
| Задачи | Блок ИИ-задач (отдельный модуль Groq) |

---

## 11. Файлы в репозитории

| Файл | Роль |
|------|------|
| `src/utils/leadActivity.ts` | Расчёт статуса, patch при апдейте |
| `src/utils/dateUtils.ts` | Дни/месяцы, openedDate |
| `src/utils/leadActivityNotify.ts` | Какие уведомления слать |
| `src/utils/syncOpenedMonths.ts` | Массово проставить дату из истории |
| `src/hooks/useClients.ts` | Касания/движение при действиях |
| `src/components/layout/LeadActivityScanner.tsx` | Ежедневный пересчёт в браузере |
| `src/components/crm/ActivityBadge.tsx` | Бейдж |
| `src/pages/CRM.tsx` | Фильтры |
| `src/pages/Dashboard.tsx` | Сводка |
| `src/components/crm/ClientDetail.tsx` | Календарь даты открытия |

---

## 12. Что делать менеджеру на практике

1. Открыть карточку клиента.  
2. В календаре поставить **день первого реального общения**.  
3. Указать **следующий шаг + срок**.  
4. Регулярно писать/звонить (обновляется касание).  
5. Двигать этап / ожидание хотя бы раз в ~45 дней.

Тогда со 2-го месяца при нормальной работе статус станет **Активный**.

---

## 13. Чего в этом модуле нет

- Не считает KPI и не режет оплату сам (это отдельно)
- Не прячет замороженных от менеджера
- Не переводит автоматически в «Отказ»
- Не шлёт Telegram/SMS — только уведомления в CRM
