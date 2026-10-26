import { ScrollView, View } from 'react-native';
import { PageHeader } from '@/components/Header';
import { Body, Eyebrow, Screen, Title } from '@/components/ui';

const SECTIONS: [string, string][] = [
  ['Ce que nous collectons', 'Le pseudo que vous choisissez, vos actions de jeu (enchères, votes) et un jeton de session invité généré aléatoirement. Aucun compte, aucune adresse e-mail, aucun numéro de téléphone, aucune donnée de localisation.'],
  ['Pourquoi', 'Faire fonctionner la partie en temps réel, vous permettre de vous reconnecter à votre équipe et afficher les résultats. Les adresses IP des votants spectateurs sont hachées et servent uniquement à limiter les votes répétés.'],
  ['Où et combien de temps', 'Les données de partie sont stockées sur notre serveur de jeu (PostgreSQL) et supprimées après 30 jours. Le jeton de session est conservé sur votre appareil (stockage sécurisé sur iOS/Android, stockage local sur le web).'],
  ['Partage', 'Aucune donnée n’est vendue ni partagée à des fins publicitaires. Les autres joueurs du salon voient votre pseudo, votre équipe et vos enchères.'],
  ['Argent réel', 'Build Your Team n’utilise aucun argent réel : les budgets sont virtuels et n’ont aucune valeur.'],
  ['Données des joueurs', 'Les footballeurs affichés dans cette version sont fictifs (données de démonstration). Toute ressemblance avec des personnes réelles est fortuite.'],
  ['Vos droits', 'Pour toute demande d’accès ou de suppression, contactez l’éditeur à l’adresse indiquée sur la fiche de l’application. (À compléter avant publication.)'],
];

export default function Privacy() {
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 18, alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: 680, gap: 18 }}>
          <PageHeader />
          <Title size={38}>Confidentialité</Title>
          {SECTIONS.map(([title, text]) => (
            <View key={title} style={{ gap: 6 }}>
              <Eyebrow>{title}</Eyebrow>
              <Body dim>{text}</Body>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
