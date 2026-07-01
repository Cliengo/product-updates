import { notFound } from 'next/navigation'
import { getFeatureById } from '@/lib/db/repository'
import EditForm from '@/components/EditForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditFeaturePage({ params }: PageProps) {
  const { id } = await params
  const feature = await getFeatureById(id)
  if (!feature) notFound()

  return <EditForm feature={feature} />
}
