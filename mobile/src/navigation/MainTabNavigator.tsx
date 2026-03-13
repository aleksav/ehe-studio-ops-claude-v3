import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@ehestudio-ops/shared';

import DashboardScreen from '../screens/DashboardScreen';
import ProjectsScreen from '../screens/ProjectsScreen';
import ProjectDetailScreen from '../screens/ProjectDetailScreen';
import TimeLoggingScreen from '../screens/TimeLoggingScreen';
import StandupScreen from '../screens/StandupScreen';
import MoreScreen from '../screens/MoreScreen';
import ClientsScreen from '../screens/ClientsScreen';
import TeamScreen from '../screens/TeamScreen';
import AuditLogScreen from '../screens/AuditLogScreen';
import WeeklyGridScreen from '../screens/WeeklyGridScreen';

import type { MainTabParamList, ProjectsStackParamList, MoreStackParamList } from './types';

// --- Projects Stack ---
const ProjectsStack = createNativeStackNavigator<ProjectsStackParamList>();

function ProjectsStackNavigator() {
  return (
    <ProjectsStack.Navigator>
      <ProjectsStack.Screen
        name="ProjectsList"
        component={ProjectsScreen}
        options={{ title: 'Projects' }}
      />
      <ProjectsStack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{ title: 'Project' }}
      />
    </ProjectsStack.Navigator>
  );
}

// --- More Stack ---
const MoreStack = createNativeStackNavigator<MoreStackParamList>();

function MoreStackNavigator() {
  return (
    <MoreStack.Navigator>
      <MoreStack.Screen name="MoreMenu" component={MoreScreen} options={{ title: 'More' }} />
      <MoreStack.Screen name="Clients" component={ClientsScreen} />
      <MoreStack.Screen name="Team" component={TeamScreen} />
      <MoreStack.Screen
        name="AuditLog"
        component={AuditLogScreen}
        options={{ title: 'Audit Log' }}
      />
      <MoreStack.Screen
        name="WeeklyGrid"
        component={WeeklyGridScreen}
        options={{ title: 'Weekly Grid' }}
      />
    </MoreStack.Navigator>
  );
}

// --- Main Tab Navigator ---
const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#999',
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerShown: true,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Projects"
        component={ProjectsStackNavigator}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Time"
        component={TimeLoggingScreen}
        options={{
          headerShown: true,
          title: 'Time Logging',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Standup"
        component={StandupScreen}
        options={{
          headerShown: true,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreStackNavigator}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="menu-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
