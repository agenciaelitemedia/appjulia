import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Users } from "lucide-react";
import { EquipeDashboardTab } from "./components/EquipeDashboardTab";
import { EquipeManagementTab } from "./components/EquipeManagementTab";

export default function EquipePage() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="management" className="gap-2">
            <Users className="w-4 h-4" />
            Gestão de Equipe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <EquipeDashboardTab />
        </TabsContent>

        <TabsContent value="management">
          <EquipeManagementTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
