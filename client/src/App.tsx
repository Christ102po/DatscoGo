import { Route, Switch } from "wouter";
import { UserDashboard } from "./pages/UserDashboard";
import { AdminDashboard } from "./pages/AdminDashboard";
import { DriverDashboard } from "./pages/DriverDashboard";

export default function App() {
  return (
    <Switch>
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/driver" component={DriverDashboard} />
      <Route component={UserDashboard} />
    </Switch>
  );
}
