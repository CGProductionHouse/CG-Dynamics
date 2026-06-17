import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Platform } from '../../lib/reportStats'
import { PLATFORM_LABELS, formatNumber } from '../../lib/reportStats'
import type { PackageSettings } from '../../lib/db/clients'
import type { CalendarEvent } from '../../lib/contentCalendar'
import { DELIVERABLE_LABELS } from '../../lib/contentCalendar'
import {
  STRATEGY_CATEGORY_LABELS,
  createStrategyOption,
  deleteStrategyOption,
  isPersistedOption,
  type StrategyCategory,
  type StrategyOption,
} from '../../lib/db/strategyOptions'
import {
  ACTION_PLAN_LABELS,
  CONTENT_TYPES,
  generateActionPlan,
  generateStrategyGoingForward,
  type ActionPlanKey,
  type ActionPlanSection,
  type StrategyData,
} from '../../lib/strategyEngine'

export interface StrategyContext {
  clientName: string
  packageSettings: PackageSettings
  calendarEvents: CalendarEvent[]
  topPost: { caption: string | null; platform: Platform | null; metricLabel: string; metricValue: number } | null
}

const ACTION_OPTION_CATEGORY: Record<ActionPlanKey, StrategyCategory> = {
  professional_video: 'professional_video_action',
  reels: 'reels_action',
  photo_content: 'photo_content_action',
  design_poster: 'design_poster_action',
  animated_poster: 'animated_poster_action',
  campaign_recommendation: 'campaign_recommendation',
}

// ─── editor ──────────────────────────────────────────────────────────────────

export function GuidedStrategyEditor({
  data,
  onChange,
  context,
  optionsByCategory,
  usingDefaults,
  isAdmin,
  onReloadOptions,
}: {
  data: StrategyData
  onChange: (next: StrategyData) => void
  context: StrategyContext
  optionsByCategory: Record<StrategyCategory, StrategyOption[]>
  usingDefaults: boolean
  isAdmin: boolean
  onReloadOptions: () => void
}) {
  const [editingCategory, setEditingCategory] = useState<StrategyCategory | null>(null)

  function patch(partial: Partial<StrategyData>) {
    onChange({ ...data, ...partial })
  }

  const selectedCalendar = data.calendarSelections

  function handleGenerateStrategy() {
    const text = generateStrategyGoingForward({
      clientName: context.clientName,
      data,
      selectedCalendar,
      packageSettings: context.packageSettings,
    })
    patch({ strategyGoingForward: text })
  }

  function handleGenerateActionPlan() {
    const plan = generateActionPlan({
      clientName: context.clientName,
      data,
      selectedCalendar,
      packageSettings: context.packageSettings,
    })
    patch({ actionPlan: plan })
  }

  function toggleCalendar(event: CalendarEvent) {
    const existing = data.calendarSelections.find(s => s.eventId === event.id)
    let next
    if (existing) {
      next = data.calendarSelections.map(s =>
        s.eventId === event.id ? { ...s, use: !s.use } : s
      )
    } else {
      next = [
        ...data.calendarSelections,
        { eventId: event.id, title: event.title, date: event.date, use: true, note: '' },
      ]
    }
    patch({ calendarSelections: next })
  }

  function setCalendarNote(event: CalendarEvent, note: string) {
    const exists = data.calendarSelections.some(s => s.eventId === event.id)
    const next = exists
      ? data.calendarSelections.map(s => (s.eventId === event.id ? { ...s, note } : s))
      : [...data.calendarSelections, { eventId: event.id, title: event.title, date: event.date, use: false, note }]
    patch({ calendarSelections: next })
  }

  return (
    <div className="space-y-5">
      {usingDefaults && isAdmin && (
        <p className="rounded-lg border border-sky-300/30 bg-sky-300/10 px-3 py-2 text-xs text-sky-200">
          Showing built-in default options. Run the phase-3k migration (strategy_options) to add, edit or
          reorder the global option library.
        </p>
      )}

      {/* 1. Client direction */}
      <Section title="Client direction" subtitle="What is the client trying to achieve this period?">
        <MultiSelect
          category="client_direction"
          options={optionsByCategory.client_direction}
          selected={data.clientDirection}
          onChange={values => patch({ clientDirection: values })}
          isAdmin={isAdmin}
          usingDefaults={usingDefaults}
          onEdit={() => setEditingCategory('client_direction')}
        />
        <LabeledTextarea
          label="Client request / direction notes"
          value={data.clientRequestNotes}
          onChange={value => patch({ clientRequestNotes: value })}
          placeholder="Client requested Father’s Day content, winter specials, and more focus on table bookings."
        />
      </Section>

      {/* 2. Top content insight */}
      <Section title="Top content insight" subtitle="The app picks the top post from the data. Add why it worked.">
        <div className="rounded-lg border border-brand-muted bg-brand-bg/50 p-3">
          {context.topPost && context.topPost.caption ? (
            <>
              <p className="text-sm font-medium text-white">{context.topPost.caption}</p>
              <p className="mt-1 text-xs text-brand-primary">
                {context.topPost.platform ? `${PLATFORM_LABELS[context.topPost.platform]} · ` : ''}
                {context.topPost.metricLabel}: {formatNumber(context.topPost.metricValue)}
              </p>
            </>
          ) : (
            <p className="text-xs text-brand-primary">No top post detected yet — import data for this month.</p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <LabeledInput
            label="Cover image / thumbnail URL (optional)"
            value={data.topContent.coverImageUrl}
            onChange={value => patch({ topContent: { ...data.topContent, coverImageUrl: value } })}
            placeholder="https://…/cover.jpg"
          />
          <label className="block">
            <span className="block text-xs font-medium text-brand-primary mb-1">Content type</span>
            <select
              value={data.topContent.contentType}
              onChange={e => patch({ topContent: { ...data.topContent, contentType: e.target.value } })}
              className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-accent"
            >
              <option value="">Select…</option>
              {CONTENT_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-brand-primary">Why it worked</p>
          <MultiSelect
            category="why_it_worked"
            options={optionsByCategory.why_it_worked}
            selected={data.topContent.whyItWorked}
            onChange={values => patch({ topContent: { ...data.topContent, whyItWorked: values } })}
            isAdmin={isAdmin}
            usingDefaults={usingDefaults}
            onEdit={() => setEditingCategory('why_it_worked')}
          />
        </div>
        <LabeledTextarea
          label="What this tells us"
          value={data.topContent.whatThisTellsUs}
          onChange={value => patch({ topContent: { ...data.topContent, whatThisTellsUs: value } })}
          placeholder="The best response came from content that showed the actual customer experience, not generic design content."
        />
      </Section>

      {/* 3. Strategy going forward */}
      <Section
        title="Strategy going forward"
        subtitle="Pick the drivers, generate an editable draft, then refine."
        action={
          <button type="button" onClick={handleGenerateStrategy} className={GENERATE_BTN}>
            Generate draft
          </button>
        }
      >
        <MultiSelect
          category="strategy_driver"
          options={optionsByCategory.strategy_driver}
          selected={data.strategyDrivers}
          onChange={values => patch({ strategyDrivers: values })}
          isAdmin={isAdmin}
          usingDefaults={usingDefaults}
          onEdit={() => setEditingCategory('strategy_driver')}
        />
        <LabeledTextarea
          label="Strategy going forward"
          value={data.strategyGoingForward}
          onChange={value => patch({ strategyGoingForward: value })}
          rows={5}
          placeholder="Based on this period’s results and the client’s current direction, the strategy going forward is to…"
        />
      </Section>

      {/* 4. Action plan */}
      <Section
        title="Action plan"
        subtitle="Auto-generated from the package, then fully editable."
        action={
          <button type="button" onClick={handleGenerateActionPlan} className={GENERATE_BTN}>
            Generate from package
          </button>
        }
      >
        <div className="space-y-3">
          {(Object.keys(ACTION_PLAN_LABELS) as ActionPlanKey[]).map(key => (
            <ActionPlanEditor
              key={key}
              planKey={key}
              section={data.actionPlan[key]}
              options={optionsByCategory[ACTION_OPTION_CATEGORY[key]]}
              isAdmin={isAdmin}
              usingDefaults={usingDefaults}
              onEdit={() => setEditingCategory(ACTION_OPTION_CATEGORY[key])}
              onChange={section => patch({ actionPlan: { ...data.actionPlan, [key]: section } })}
            />
          ))}
        </div>
      </Section>

      {/* 5. Client actions required */}
      <Section title="Client actions required" subtitle="What do we need from the client?">
        <MultiSelect
          category="client_action_required"
          options={optionsByCategory.client_action_required}
          selected={data.clientActionsRequired}
          onChange={values => patch({ clientActionsRequired: values })}
          isAdmin={isAdmin}
          usingDefaults={usingDefaults}
          onEdit={() => setEditingCategory('client_action_required')}
        />
      </Section>

      {/* Calendar suggestions */}
      <Section title="Calendar suggestions for this period" subtitle="South African public holidays and key dates. Use the relevant ones to feed strategy and the action plan.">
        {context.calendarEvents.length === 0 ? (
          <p className="text-xs text-brand-primary">No notable dates for this month.</p>
        ) : (
          <div className="space-y-2">
            {context.calendarEvents.map(event => {
              const selection = data.calendarSelections.find(s => s.eventId === event.id)
              const used = selection?.use ?? false
              return (
                <div key={event.id} className="rounded-lg border border-brand-muted bg-brand-bg/40 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">
                        {event.title}
                        {event.date && <span className="ml-2 text-xs text-brand-primary">{event.date}</span>}
                      </p>
                      <p className="mt-1 text-xs text-brand-primary">{event.relevanceHint}</p>
                      <p className="mt-1 text-xs text-brand-primary/80">{event.suggestedAngle}</p>
                      <p className="mt-1 text-[11px] text-brand-primary/60">
                        Suggested: {event.deliverables.map(d => DELIVERABLE_LABELS[d]).join(', ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleCalendar(event)}
                      className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                        used
                          ? 'border-brand-accent bg-brand-accent/10 text-brand-accent'
                          : 'border-brand-muted text-brand-primary hover:text-white hover:border-white/30'
                      }`}
                    >
                      {used ? 'Using ✓' : 'Use in strategy'}
                    </button>
                  </div>
                  <input
                    value={selection?.note ?? ''}
                    onChange={e => setCalendarNote(event, e.target.value)}
                    placeholder="Add a custom angle or note (optional)"
                    className="mt-2 w-full bg-brand-surface border border-brand-muted rounded-lg px-3 py-1.5 text-xs text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  />
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {editingCategory && (
        <OptionsEditorModal
          category={editingCategory}
          options={optionsByCategory[editingCategory]}
          usingDefaults={usingDefaults}
          onClose={() => setEditingCategory(null)}
          onChanged={onReloadOptions}
        />
      )}
    </div>
  )
}

const GENERATE_BTN =
  'rounded-lg bg-brand-accent px-3 py-2 text-xs font-semibold text-brand-bg transition hover:brightness-110'

// ─── action plan section editor ──────────────────────────────────────────────

function ActionPlanEditor({
  planKey,
  section,
  options,
  isAdmin,
  usingDefaults,
  onEdit,
  onChange,
}: {
  planKey: ActionPlanKey
  section: ActionPlanSection
  options: StrategyOption[]
  isAdmin: boolean
  usingDefaults: boolean
  onEdit: () => void
  onChange: (section: ActionPlanSection) => void
}) {
  return (
    <div className="rounded-lg border border-brand-muted bg-brand-bg/40 p-3">
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={section.enabled}
          onChange={e => onChange({ ...section, enabled: e.target.checked })}
          className="h-4 w-4 rounded accent-brand-accent"
        />
        <span className="text-sm font-semibold text-white">{ACTION_PLAN_LABELS[planKey]}</span>
      </label>
      {section.enabled && (
        <div className="mt-3 space-y-2">
          <MultiSelect
            category={ACTION_OPTION_CATEGORY[planKey]}
            options={options}
            selected={section.items}
            onChange={items => onChange({ ...section, items })}
            isAdmin={isAdmin}
            usingDefaults={usingDefaults}
            onEdit={onEdit}
          />
          <textarea
            value={section.notes}
            onChange={e => onChange({ ...section, notes: e.target.value })}
            rows={2}
            placeholder="Notes for this deliverable (optional)"
            className="w-full bg-brand-surface border border-brand-muted rounded-lg px-3 py-2 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
        </div>
      )}
    </div>
  )
}

// ─── multi-select with editable options + custom "Other" ─────────────────────

function MultiSelect({
  category,
  options,
  selected,
  onChange,
  isAdmin,
  usingDefaults,
  onEdit,
}: {
  category: StrategyCategory
  options: StrategyOption[]
  selected: string[]
  onChange: (values: string[]) => void
  isAdmin: boolean
  usingDefaults: boolean
  onEdit: () => void
}) {
  const [custom, setCustom] = useState('')
  const optionLabels = new Set(options.map(o => o.label))
  const customSelected = selected.filter(label => !optionLabels.has(label))

  function toggle(label: string) {
    onChange(selected.includes(label) ? selected.filter(l => l !== label) : [...selected, label])
  }

  function addCustom() {
    const value = custom.trim()
    if (!value || selected.includes(value)) {
      setCustom('')
      return
    }
    onChange([...selected, value])
    setCustom('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const active = selected.includes(option.label)
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggle(option.label)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? 'border-brand-accent bg-brand-accent/15 text-brand-accent'
                  : 'border-brand-muted text-brand-primary hover:text-white hover:border-white/30'
              }`}
            >
              {active ? '✓ ' : ''}{option.label}
            </button>
          )
        })}
        {customSelected.map(label => (
          <button
            key={`custom:${label}`}
            type="button"
            onClick={() => toggle(label)}
            className="rounded-full border border-brand-accent bg-brand-accent/15 px-3 py-1.5 text-xs font-medium text-brand-accent"
          >
            ✓ {label} ✕
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addCustom()
            }
          }}
          placeholder="Other (type and press Enter)"
          className="flex-1 bg-brand-bg border border-brand-muted rounded-lg px-3 py-1.5 text-xs text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
        />
        <button
          type="button"
          onClick={addCustom}
          className="rounded-lg border border-brand-muted px-3 py-1.5 text-xs text-brand-primary hover:text-white hover:border-white/30"
        >
          Add
        </button>
        {isAdmin && !usingDefaults && (
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-brand-muted px-3 py-1.5 text-xs text-brand-primary hover:text-brand-accent"
            title={`Edit ${STRATEGY_CATEGORY_LABELS[category]} options`}
          >
            Edit options
          </button>
        )}
      </div>
    </div>
  )
}

// ─── options library editor (admin) ──────────────────────────────────────────

function OptionsEditorModal({
  category,
  options,
  usingDefaults,
  onClose,
  onChanged,
}: {
  category: StrategyCategory
  options: StrategyOption[]
  usingDefaults: boolean
  onClose: () => void
  onChanged: () => void
}) {
  const [newLabel, setNewLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    const label = newLabel.trim()
    if (!label) return
    setBusy(true)
    setError(null)
    const { error } = await createStrategyOption({ category, label, sort_order: options.length + 1 })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setNewLabel('')
    onChanged()
  }

  async function handleDelete(option: StrategyOption) {
    if (!isPersistedOption(option)) return
    setBusy(true)
    setError(null)
    const { error } = await deleteStrategyOption(option.id)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    onChanged()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={e => { if (!busy && e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-md rounded-xl border border-brand-muted bg-brand-surface p-5 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <h3 className="mb-1 text-base font-semibold text-white">Edit options — {STRATEGY_CATEGORY_LABELS[category]}</h3>
        <p className="mb-4 text-xs text-brand-primary">
          Changes apply to future reports only. Reports already saved keep the labels chosen at the time.
        </p>

        {usingDefaults ? (
          <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
            These are built-in defaults. Run the phase-3k migration to store and edit the option library.
          </p>
        ) : (
          <>
            <div className="mb-3 max-h-64 space-y-1.5 overflow-y-auto">
              {options.map(option => (
                <div key={option.id} className="flex items-center justify-between gap-3 rounded-lg border border-brand-muted bg-brand-bg/50 px-3 py-2">
                  <span className="min-w-0 truncate text-sm text-white">{option.label}</span>
                  {isPersistedOption(option) ? (
                    <button
                      type="button"
                      onClick={() => void handleDelete(option)}
                      disabled={busy}
                      className="shrink-0 text-xs text-brand-primary hover:text-red-400 disabled:opacity-60"
                    >
                      Delete
                    </button>
                  ) : (
                    <span className="shrink-0 text-[11px] text-brand-primary/60">default</span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleAdd() } }}
                placeholder="New option label"
                className="flex-1 bg-brand-bg border border-brand-muted rounded-lg px-3 py-2 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
              />
              <button
                type="button"
                onClick={() => void handleAdd()}
                disabled={busy || !newLabel.trim()}
                className="rounded-lg bg-brand-accent px-3 py-2 text-sm font-semibold text-brand-bg hover:brightness-110 disabled:opacity-60"
              >
                Add
              </button>
            </div>
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-brand-muted px-4 py-2 text-sm text-brand-primary hover:text-white hover:border-white/30 disabled:opacity-60"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── shared small bits ───────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-brand-muted bg-brand-surface p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-brand-primary">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-brand-primary mb-1">{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3 py-2 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
      />
    </label>
  )
}

function LabeledTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-brand-primary mb-1">{label}</span>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full bg-brand-bg border border-brand-muted rounded-lg px-3 py-2 text-sm text-white placeholder-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-accent"
      />
    </label>
  )
}

// ─── client-facing view ──────────────────────────────────────────────────────

export function GuidedStrategyView({ data }: { data: StrategyData }) {
  const usedCalendar = data.calendarSelections.filter(s => s.use)
  const activePlans = (Object.keys(ACTION_PLAN_LABELS) as ActionPlanKey[])
    .map(key => ({ key, section: data.actionPlan[key] }))
    .filter(({ section }) => section.enabled && (section.items.length > 0 || section.notes.trim() !== ''))

  return (
    <div className="space-y-4">
      {(data.clientDirection.length > 0 || data.clientRequestNotes.trim()) && (
        <ViewCard title="Client direction">
          {data.clientDirection.length > 0 && <ChipRow items={data.clientDirection} />}
          {data.clientRequestNotes.trim() && (
            <p className="mt-3 text-sm leading-relaxed text-white whitespace-pre-line">{data.clientRequestNotes}</p>
          )}
        </ViewCard>
      )}

      {(data.topContent.whyItWorked.length > 0 || data.topContent.whatThisTellsUs.trim() || data.topContent.coverImageUrl) && (
        <ViewCard title="Top content insight">
          {data.topContent.coverImageUrl && (
            <img
              src={data.topContent.coverImageUrl}
              alt="Top content cover"
              className="mb-3 max-h-64 w-full rounded-lg border border-brand-muted object-cover"
              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
            />
          )}
          {data.topContent.autoCaption && (
            <p className="text-sm font-medium text-white">{data.topContent.autoCaption}</p>
          )}
          {(data.topContent.contentType || data.topContent.autoPlatform) && (
            <p className="mt-1 text-xs text-brand-primary">
              {[data.topContent.contentType, data.topContent.autoPlatform ? PLATFORM_LABELS[data.topContent.autoPlatform] : '']
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {data.topContent.whyItWorked.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs uppercase tracking-[0.14em] text-brand-primary">Why it worked</p>
              <ChipRow items={data.topContent.whyItWorked} />
            </div>
          )}
          {data.topContent.whatThisTellsUs.trim() && (
            <p className="mt-3 text-sm leading-relaxed text-white whitespace-pre-line">{data.topContent.whatThisTellsUs}</p>
          )}
        </ViewCard>
      )}

      {data.strategyGoingForward.trim() && (
        <ViewCard title="Strategy going forward">
          <p className="text-sm leading-relaxed text-white whitespace-pre-line">{data.strategyGoingForward}</p>
        </ViewCard>
      )}

      {activePlans.length > 0 && (
        <ViewCard title="Action plan">
          <div className="space-y-4">
            {activePlans.map(({ key, section }) => (
              <div key={key}>
                <p className="text-sm font-semibold text-brand-accent">{ACTION_PLAN_LABELS[key]}</p>
                {section.items.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {section.items.map((item, index) => (
                      <li key={index} className="flex gap-2 text-sm text-white">
                        <span className="text-brand-accent">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {section.notes.trim() && (
                  <p className="mt-1.5 text-sm leading-relaxed text-brand-primary whitespace-pre-line">{section.notes}</p>
                )}
              </div>
            ))}
          </div>
        </ViewCard>
      )}

      {data.clientActionsRequired.length > 0 && (
        <ViewCard title="Client actions required">
          <ul className="space-y-1">
            {data.clientActionsRequired.map((item, index) => (
              <li key={index} className="flex gap-2 text-sm text-white">
                <span className="text-brand-accent">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </ViewCard>
      )}

      {usedCalendar.length > 0 && (
        <ViewCard title="Key dates ahead">
          <ul className="space-y-1.5">
            {usedCalendar.map(s => (
              <li key={s.eventId} className="text-sm text-white">
                <span className="font-medium">{s.title}</span>
                {s.date && <span className="ml-2 text-xs text-brand-primary">{s.date}</span>}
                {s.note.trim() && <span className="block text-xs text-brand-primary">{s.note}</span>}
              </li>
            ))}
          </ul>
        </ViewCard>
      )}
    </div>
  )
}

function ViewCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="rounded-xl border border-brand-muted bg-brand-surface p-5 sm:p-6">
      <p className="mb-3 text-xs uppercase tracking-[0.18em] text-brand-primary">{title}</p>
      {children}
    </article>
  )
}

function ChipRow({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <span key={index} className="rounded-full border border-brand-accent/30 bg-brand-accent/10 px-3 py-1 text-xs font-medium text-brand-accent">
          {item}
        </span>
      ))}
    </div>
  )
}
