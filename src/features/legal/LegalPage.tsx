import { ArrowLeft } from 'lucide-react'

import { APP_NAME, BrandLogo } from '@/components/brand'

const CONTACT = 'gabrielg.pereira@outlook.com'
const UPDATED = '6 de outubro de 2026'

/** Rotas públicas (sem login) exigidas pela tela de consentimento do Google. */
export const LEGAL_PATHS = ['/privacidade', '/termos'] as const

export function isLegalPath(pathname: string): boolean {
  return LEGAL_PATHS.some((p) => pathname === p || pathname === `${p}/`)
}

export function LegalPage({ page }: { page: 'privacidade' | 'termos' }) {
  return (
    <div className="app-backdrop min-h-dvh px-5 py-10">
      <article className="mx-auto max-w-2xl space-y-4 text-[15px] leading-relaxed text-muted-foreground [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_strong]:text-foreground">
        <a href="/" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" /> Voltar ao {APP_NAME}
        </a>
        <BrandLogo className="-ml-3 w-32" />
        {page === 'privacidade' ? <Privacy /> : <Terms />}
        <p className="pt-6 text-[13px]">Última atualização: {UPDATED}. Dúvidas: {CONTACT}.</p>
      </article>
    </div>
  )
}

function Privacy() {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold text-foreground">Política de Privacidade</h1>
      <p>
        O {APP_NAME} é um monitor pessoal de hábitos, tarefas e habilidades. Esta política explica quais dados usamos e por quê, de forma direta.
      </p>
      <h2>O que coletamos</h2>
      <p>
        <strong>Da sua conta Google:</strong> nome, e-mail e foto de perfil — apenas para identificar sua conta e mostrar quem está conectado. Não acessamos
        Gmail, Drive, contatos, agenda nem qualquer outro dado do Google.
      </p>
      <p>
        <strong>O que você cadastra no app:</strong> hábitos, registros, tarefas, dias encerrados, habilidades, pontuação e preferências.
      </p>
      <h2>Onde ficam</h2>
      <p>
        Os dados são armazenados no Supabase (banco de dados PostgreSQL hospedado) e em cache no seu navegador para o app funcionar offline. O acesso é
        protegido por regras de segurança que permitem que cada conta leia e altere somente os próprios dados.
      </p>
      <h2>Como usamos</h2>
      <p>Somente para fazer o app funcionar e sincronizar entre seus aparelhos. Não vendemos, não compartilhamos com terceiros e não usamos para anúncios.</p>
      <h2>Seus controles</h2>
      <p>
        Em <strong>Perfil → Ajustes</strong> você exporta todos os seus dados (JSON) ou apaga tudo. Para excluir a conta por completo, escreva para o
        contato abaixo e ela será removida.
      </p>
    </>
  )
}

function Terms() {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold text-foreground">Termos de Uso</h1>
      <p>
        O {APP_NAME} é oferecido gratuitamente, “no estado em que se encontra”, como ferramenta pessoal de organização e acompanhamento de hábitos.
      </p>
      <h2>Uso</h2>
      <p>Você é responsável pelo que cadastra e por manter o acesso à sua conta Google. Não use o serviço para atividades ilegais ou para sobrecarregá-lo.</p>
      <h2>Disponibilidade</h2>
      <p>
        Fazemos o possível para manter o serviço no ar e seus dados seguros, mas não há garantia de disponibilidade contínua. Recomendamos exportar
        backups de vez em quando (Perfil → Ajustes → Exportar dados).
      </p>
      <h2>Mudanças</h2>
      <p>O app e estes termos podem mudar. Alterações relevantes serão avisadas no próprio app.</p>
      <h2>Privacidade</h2>
      <p>
        Veja a <a href="/privacidade" className="text-primary hover:underline">Política de Privacidade</a>.
      </p>
    </>
  )
}
