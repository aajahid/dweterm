export type ShellKey = "powershell" | "bash";

export type ShellProfile = {
  key: ShellKey;
  displayName: string;
  pathSeparator: "\\" | "/";
  commandStarters: ReadonlySet<string>;
  commandStarterPrefixes: readonly string[];
  dangerousPatterns: readonly RegExp[];
  cautionPatterns: readonly RegExp[];
};
