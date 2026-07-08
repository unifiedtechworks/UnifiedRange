export type AmplifyClientStatus = {
  configured: boolean;
  message: string;
};

export function getAmplifyClientStatus(): AmplifyClientStatus {
  return {
    configured: false,
    message:
      "Amplify client wiring is staged for Cognito and AppSync. Run the Amplify sandbox to generate outputs before connecting live data."
  };
}
