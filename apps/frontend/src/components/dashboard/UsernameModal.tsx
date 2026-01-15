import { useState } from "react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface UsernameModalProps {
  isOpen: boolean;
  onSave: (username: string) => void;
}

export function UsernameModal({ isOpen, onSave }: UsernameModalProps) {
  const [value, setValue] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Welcome
          </CardTitle>
          <CardDescription>
            Please enter your Instagram username to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="username"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && value.trim()) {
                onSave(value.trim());
              }
            }}
          />
        </CardContent>
        <CardFooter className="justify-end">
          <Button 
            disabled={!value.trim()} 
            onClick={() => onSave(value.trim())}
          >
            Continue
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
