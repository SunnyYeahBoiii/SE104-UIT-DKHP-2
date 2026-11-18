import { Card } from './ui'

/** Shell-only placeholder: the feature behind this tab belongs to a later vertical slice. */
export function EmptyPlaceholder({ title }: { title: string }) {
  return (
    <Card>
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        Nội dung của mục này sẽ xuất hiện ở slice tiếp theo.
      </p>
    </Card>
  )
}
