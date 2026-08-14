import { useCountriesList } from '@/hooks/useCountries'
import { useClientStages } from '@/hooks/useClientStages'

/** Keeps live country/stage caches warm for the whole app. */
export function CrmConfigBootstrap() {
  useCountriesList()
  useClientStages()
  return null
}
