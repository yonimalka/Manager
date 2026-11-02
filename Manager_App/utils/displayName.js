export function displayName(user) {
  return (
    user?.businessName ||
    (user?.name && user.name !== "Apple User" ? user.name : "") ||
    ""
  ).trim();
}

export function hasRealName(user) {
  return displayName(user).length > 0;
}
