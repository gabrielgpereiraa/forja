import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { acceptLegacyImport, declineLegacyImport, useSession } from './session'

/** Primeiro login numa conta vazia + dados antigos neste navegador → oferecer importação. */
export function ImportPrompt() {
  const offer = useSession((s) => s.legacyOffer)
  if (!offer) return null
  const parts = [
    offer.habits.length && `${offer.habits.length} hábito${offer.habits.length > 1 ? 's' : ''}`,
    offer.tasks.length && `${offer.tasks.length} tarefa${offer.tasks.length > 1 ? 's' : ''}`,
    offer.skills.length && `${offer.skills.length} habilidade${offer.skills.length > 1 ? 's' : ''}`,
    Object.keys(offer.records).length && `${Object.keys(offer.records).length} dias de histórico`,
  ].filter(Boolean)

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Trazer seus dados deste aparelho?</AlertDialogTitle>
          <AlertDialogDescription>
            Encontramos o que você usou antes sem conta{offer.profile.name ? `, ${offer.profile.name}` : ''}: {parts.join(', ') || 'seu perfil'}. Importando, tudo passa a
            ficar salvo na sua conta.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={declineLegacyImport}>Começar do zero</AlertDialogCancel>
          <AlertDialogAction onClick={acceptLegacyImport}>Importar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
