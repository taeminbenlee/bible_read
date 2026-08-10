import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [];

@NgModule({
  imports: [RouterModule.forRoot(routes, { useHash: true })], // useHash 추가
  exports: [RouterModule]
})
export class AppRoutingModule { }
