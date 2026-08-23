import { useParams } from "react-router-dom";
import { PackagesModule } from "@/components/packages";
import { ServicesModule } from "@/components/services";
import { ProcessesModule } from "@/components/processes";
import { UsersModule } from "@/components/users";
import { FirewallModule } from "@/components/firewall";
import { RepositoriesModule } from "@/components/repositories";
import { FilesModule } from "@/components/files";
import { LogsModule } from "@/components/logs";
import { DockerModule } from "@/components/docker";
import { NetworkModule } from "@/components/network";
import { DiskModule } from "@/components/disk";
import { BackupsModule } from "@/components/backups";
import { CommandsModule } from "@/components/commands";
import { AIModule } from "@/components/ai";
import { AuditModule } from "@/components/audit";
import { SoftwareInstallerModule } from "@/components/software-installer";
import { PackageCleanerModule } from "@/components/package-cleaner";
import { InstalledAppsModule } from "@/components/installed-apps";

const modules: Record<string, React.ComponentType> = {
  packages: PackagesModule,
  services: ServicesModule,
  processes: ProcessesModule,
  users: UsersModule,
  firewall: FirewallModule,
  repositories: RepositoriesModule,
  files: FilesModule,
  logs: LogsModule,
  docker: DockerModule,
  network: NetworkModule,
  disk: DiskModule,
  backups: BackupsModule,
  commands: CommandsModule,
  ai: AIModule,
  audit: AuditModule,
  "software-installer": SoftwareInstallerModule,
  "package-cleaner": PackageCleanerModule,
  "installed-apps": InstalledAppsModule,
};

export default function ModulePage() {
  const { module: moduleName } = useParams<{ module: string }>();
  const ModuleComponent = moduleName ? modules[moduleName] : undefined;

  if (!ModuleComponent) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Module not found</p>
      </div>
    );
  }

  return <ModuleComponent />;
}
