import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function UnlinkedPage() {
  return (
    <div className="max-w-md mx-auto mt-16">
      <Card>
        <CardHeader>
          <CardTitle>Account not linked</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Your login is valid, but it isn&apos;t linked to an organization yet.
            Contact the administrator to finish setup.
          </p>
          <form action="/auth/signout" method="POST">
            <Button type="submit" variant="outline" className="w-full">
              Log out
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
