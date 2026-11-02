import { describe, expect, it } from 'vitest'

import { resolveScoringActivation } from '@/domain/scoring'
import { cloudEnabledFor } from '../data-mode'

const URL = 'https://exemplo.supabase.co'
const KEY = 'sb_publishable_teste'

describe('modo de dados', () => {
  it('usa a nuvem só com URL e chave', () => {
    expect(cloudEnabledFor({ url: URL, key: KEY })).toBe(true)
    expect(cloudEnabledFor({ url: URL })).toBe(false)
    expect(cloudEnabledFor({})).toBe(false)
  })

  it('VITE_DATA_MODE=local força o modo local mesmo com as variáveis do Supabase', () => {
    expect(cloudEnabledFor({ url: URL, key: KEY, mode: 'local' })).toBe(false)
    expect(cloudEnabledFor({ url: URL, key: KEY, mode: ' LOCAL ' })).toBe(false)
    expect(cloudEnabledFor({ url: URL, key: KEY, mode: 'cloud' })).toBe(true)
  })

  it('homologação: prévia em modo local liga a v2; prévia na nuvem continua travada', () => {
    const preview = { from: '2026-11-02', vercelEnv: 'preview' }
    expect(resolveScoringActivation({ ...preview, cloud: cloudEnabledFor({ url: URL, key: KEY, mode: 'local' }) }).v2From).toBe('2026-11-02')
    expect(resolveScoringActivation({ ...preview, cloud: cloudEnabledFor({ url: URL, key: KEY }) }).v2From).toBeNull()
  })
})
