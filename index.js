import { registerRootComponent } from "expo";
import { LogBox } from "react-native";
import App from "./App";

// keep the demo clean: no yellow/red developer toasts (errors are handled inside the app)
LogBox.ignoreAllLogs(true);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App)
registerRootComponent(App);
