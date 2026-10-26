import { Redirect, useLocalSearchParams } from 'expo-router';

/** Invitation link: /r/K7QF2M → join form with the code pre-filled. */
export default function Invite() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return <Redirect href={{ pathname: '/join', params: { code: (code ?? '').toUpperCase() } }} />;
}
