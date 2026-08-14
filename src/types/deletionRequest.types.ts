export type DeletionRequestStatus = 'pending' | 'approved' | 'rejected'

export interface DeletionRequest {
  id: string
  clientId: string
  clientName: string
  clientPhone: string
  reason: string
  requestedBy: string
  requestedByName: string
  status: DeletionRequestStatus
  reviewedBy: string | null
  reviewedByName: string | null
  reviewNote: string | null
  createdAt?: unknown
  updatedAt?: unknown
}
