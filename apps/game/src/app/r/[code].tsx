import { Redirect, useLocalSearchParams } from 'expo-router';

/** Invitation link: /r/K7QF2M → join form with the code pre-filled. `?team=` (duo) joins that team. */
export default function Invite() {
  const { code, team } = useLocalSearchParams<{ code: string; team?: string }>();
  return <Redirect href={{ pathname: '/join', params: { code: (code ?? '').toUpperCase(), ...(team ? { team } : {}) } }} />;
}
