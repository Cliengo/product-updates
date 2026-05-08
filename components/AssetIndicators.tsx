interface AssetIndicatorsProps {
  video?: string | null
  onePager?: string | null
  screenshots?: string | null
}

export default function AssetIndicators({ video, onePager, screenshots }: AssetIndicatorsProps) {
  const items = [
    { label: 'Video', show: !!video },
    { label: 'One-pager', show: !!onePager },
    { label: 'Screenshots', show: !!screenshots },
  ].filter(i => i.show)

  if (items.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {items.map(item => (
        <span
          key={item.label}
          className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full border border-neutral-200"
        >
          {item.label}
        </span>
      ))}
    </div>
  )
}
