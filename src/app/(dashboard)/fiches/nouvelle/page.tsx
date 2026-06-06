import { Topbar } from "@/components/layout/Topbar";
import { FicheStepper } from "@/components/forms/FicheStepper";
import { Card, CardContent } from "@/components/ui/card";

export default function NouvelleFichePage() {
  return (
    <>
      <Topbar title="Nouvelle fiche de pré-visite" />
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 lg:p-10">
            <FicheStepper />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
