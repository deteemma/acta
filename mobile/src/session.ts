// Jeton d'accès courant, lu par l'API et par PowerSync au moment de chaque appel.
let accessToken = '';

export const getAccessToken = () => accessToken;
export const setAccessToken = (token: string) => {
  accessToken = token;
};
