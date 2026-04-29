const authErrorMessages: Record<string, string> = {
  invalid_credentials: "Невірна електронна пошта або пароль.",
  email_not_confirmed: "Електронну пошту ще не підтверджено.",
  user_not_found: "Користувача не знайдено.",
  too_many_requests: "Забагато спроб входу. Спробуйте пізніше.",
};

export function getAuthErrorMessage(code?: string, message?: string) {
  if (code && authErrorMessages[code]) {
    return authErrorMessages[code];
  }

  if (message?.toLowerCase().includes("invalid login credentials")) {
    return authErrorMessages.invalid_credentials;
  }

  return "Не вдалося увійти. Перевірте дані й спробуйте ще раз.";
}
