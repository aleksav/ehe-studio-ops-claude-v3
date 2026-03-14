import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Projects: undefined;
  Time: undefined;
  Standup: undefined;
  More: undefined;
};

export type MoreStackParamList = {
  MoreMenu: undefined;
  Clients: undefined;
  Team: undefined;
  AuditLog: undefined;
  WeeklyGrid: undefined;
};

export type ProjectsStackParamList = {
  ProjectsList: undefined;
  ProjectDetail: { id: string };
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};
