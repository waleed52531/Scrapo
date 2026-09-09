import { Module } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { WorkspaceContextService } from "./workspace-context.service";

@Module({
  providers: [AuthGuard, WorkspaceContextService],
  exports: [AuthGuard, WorkspaceContextService],
})
export class AuthModule {}
